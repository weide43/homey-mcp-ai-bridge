'use strict';

const Homey = require('homey');
const { HomeyAPI } = require('homey-api');
const McpServer = require('./lib/McpServer');
const HomeySDKClient = require('./lib/HomeySDKClient');
const { registerAllTools } = require('./lib/tools/index');

const DEFAULT_PORT             = 52199;
const FLOW_RESPONSE_TIMEOUT_MS = 10000; // wait up to 10 s for "Return response" action card

class HomeyMcpApp extends Homey.App {

  async onInit() {
    this.log('[HomeyMCP] App starting...');
    this._pendingResponses = new Map(); // requestId -> resolve({ text, isError })
    await this._registerFlowCards();
    await this._startServer();
    this.log('[HomeyMCP] App ready.');
  }

  async onUninit() {
    await this._stopServer();
  }

  // ─── Flow card listeners ──────────────────────────────────────────

  async _registerFlowCards() {
    // Get card references for triggers we fire ourselves
    try { this._serverStartedCard   = this.homey.flow.getTriggerCard('mcp_server_started');   } catch (_) {}
    try { this._agentConnectedCard  = this.homey.flow.getTriggerCard('mcp_agent_connected');  } catch (_) {}

    // EN: tool name is / is not [name]
    try {
      this.homey.flow
        .getConditionCard('mcp_tool_name_is')
        .registerRunListener(async (args, state) => {
          return state.tool_name === args.tool_name;
        });
    } catch (err) {
      this.log(`[HomeyMCP] Condition card mcp_tool_name_is failed: ${err.message}`);
    }

    // EN: tool input contains [text]
    try {
      this.homey.flow
        .getConditionCard('mcp_tool_input_contains')
        .registerRunListener(async (args, state) => {
          const input  = (state.tool_input || '').toLowerCase();
          const needle = (args.text        || '').toLowerCase();
          return needle.length > 0 && input.includes(needle);
        });
    } catch (err) {
      this.log(`[HomeyMCP] Condition card mcp_tool_input_contains failed: ${err.message}`);
    }

    // EN: tool input is (not) empty
    try {
      this.homey.flow
        .getConditionCard('mcp_tool_input_is_empty')
        .registerRunListener(async (args, state) => {
          return !state.tool_input || state.tool_input.trim() === '';
        });
    } catch (err) {
      this.log(`[HomeyMCP] Condition card mcp_tool_input_is_empty failed: ${err.message}`);
    }

    // DAN: return [response] to AI agent (success)
    try {
      this.homey.flow
        .getActionCard('mcp_send_response')
        .registerRunListener(async (args, state) => {
          const resolve = this._pendingResponses.get(state.request_id);
          if (resolve) {
            this._pendingResponses.delete(state.request_id);
            resolve({ text: args.response || '', isError: false });
          }
        });
    } catch (err) {
      this.log(`[HomeyMCP] Action card mcp_send_response failed: ${err.message}`);
    }

    // DAN: return [error] to AI agent (isError: true)
    try {
      this.homey.flow
        .getActionCard('mcp_send_error')
        .registerRunListener(async (args, state) => {
          const resolve = this._pendingResponses.get(state.request_id);
          if (resolve) {
            this._pendingResponses.delete(state.request_id);
            resolve({ text: args.message || 'An error occurred in the flow', isError: true });
          }
        });
    } catch (err) {
      this.log(`[HomeyMCP] Action card mcp_send_error failed: ${err.message}`);
    }
  }

  // ─── Server lifecycle ─────────────────────────────────────────────

  async _startServer() {
    await this._stopServer();

    const port = parseInt(this.homey.settings.get('port') || DEFAULT_PORT, 10);

    // Create HomeyAPI client — full access to all managers
    this.log('[HomeyMCP] Initializing HomeyAPI...');
    const api = await HomeyAPI.createAppAPI({ homey: this.homey });
    this._api = api;

    // Try to create a PAT-based local API session for flow write operations
    let flowApi = null;
    const pat = this.homey.settings.get('personal_access_token') || null;
    if (pat) {
      try {
        let address = 'http://127.0.0.1';
        if (this.homey.cloud?.getLocalAddress) {
          try {
            const addr = await this.homey.cloud.getLocalAddress();
            if (addr) address = `http://${addr.split(':')[0]}`;
          } catch (_) {}
        }
        flowApi = await HomeyAPI.createLocalAPI({ address, token: pat });
        this.log('[HomeyMCP] Flow API initialised with PAT');
      } catch (err) {
        this.log(`[HomeyMCP] Flow API init failed (flow writes unavailable): ${err.message}`);
      }
    }

    this._client = new HomeySDKClient({ api, flowApi, homey: this.homey });

    // Get the flow trigger card reference for custom AI tools
    try {
      this._triggerCard = this.homey.flow.getTriggerCard('mcp_flow_tool');
    } catch (err) {
      this.log(`[HomeyMCP] Could not get trigger card: ${err.message}`);
      this._triggerCard = null;
    }

    // Create MCP server with all security options
    this._mcpServer = new McpServer({
      port,
      log:            this,
      getApiKey:      () => this.homey.settings.get('api_key')      || null,
      getIpWhitelist: () => this.homey.settings.get('ip_whitelist') || null,
      getRateLimit:   () => {
        const v = parseInt(this.homey.settings.get('rate_limit') || '0', 10);
        return v > 0 ? v : null;
      },
    });

    // Wire session events to flow cards
    this._mcpServer.on('session:opened', ({ sessionId, count }) => {
      if (this._agentConnectedCard) {
        this._agentConnectedCard
          .trigger({ session_id: sessionId, session_count: count }, {})
          .catch(() => {});
      }
    });

    // Register built-in tools
    registerAllTools(this._mcpServer, this._client, this.homey);

    // Register flow-defined tools
    await this._registerFlowTools();

    // Register meta tool: list active MCP sessions
    this._mcpServer.registerTool(
      'system_get_mcp_sessions',
      'Get the currently active MCP sessions connected to this server.',
      { type: 'object', properties: {} },
      async () => {
        const sessions = Array.from(this._mcpServer.sessions.entries()).map(([id, s]) => ({
          session_id:  id,
          created_at:  new Date(s.createdAt).toISOString(),
          age_seconds: Math.round((Date.now() - s.createdAt) / 1000),
        }));
        return { count: sessions.length, sessions };
      },
    );

    // Start listening
    try {
      await this._mcpServer.start();
      const address = await this._getLocalAddress();
      const url = `http://${address}:${port}/mcp`;

      this.log(`[HomeyMCP] MCP server running at ${url} (${this._mcpServer.tools.size} tools)`);
      this.homey.settings.set('status',     'running');
      this.homey.settings.set('mcp_url',    url);
      this.homey.settings.set('tool_count', this._mcpServer.tools.size);

      // Fire "server started" flow card
      if (this._serverStartedCard) {
        this._serverStartedCard
          .trigger({ tool_count: this._mcpServer.tools.size, mcp_url: url }, {})
          .catch(() => {});
      }
    } catch (err) {
      this.log(`[HomeyMCP] Failed to start server: ${err.message}`);
      this.homey.settings.set('status', `Error: ${err.message}`);
    }
  }

  async _stopServer() {
    if (this._mcpServer) {
      this._mcpServer.removeAllListeners();
      await this._mcpServer.stop();
      this._mcpServer = null;
    }
  }

  // ─── Flow tool registration ────────────────────────────────────────

  async _registerFlowTools() {
    if (!this._triggerCard || !this._api) return;

    try {
      const flows = await this._api.flow.getFlows();
      let count = 0;

      for (const [id, flow] of Object.entries(flows)) {
        try {
        const triggerId = flow.trigger && flow.trigger.id;
        if (
          triggerId !== 'mcp_flow_tool' &&
          triggerId !== 'community.mcp-ai-bridge:mcp_flow_tool' &&
          triggerId !== 'community.synapse-mcp:mcp_flow_tool'
        ) continue;

        const safeName = (flow.name || id).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const toolName = `flow_${safeName}`;
        const flowName = flow.name || id;

        this._mcpServer.registerTool(
          toolName,
          `Trigger Homey flow: ${flowName}`,
          {
            type: 'object',
            properties: {
              input: {
                type: 'string',
                description: 'Optional text input to pass to the flow',
              },
            },
          },
          async (args) => {
            const card = this._triggerCard;
            if (!card) throw new Error('Trigger card not available');

            const requestId = `${id}_${Date.now()}_${require('crypto').randomBytes(4).toString('hex')}`;

            const responsePromise = new Promise((resolve) => {
              this._pendingResponses.set(requestId, resolve);
              setTimeout(() => {
                if (this._pendingResponses.has(requestId)) {
                  this._pendingResponses.delete(requestId);
                  resolve({ text: `Flow "${flowName}" triggered successfully`, isError: false });
                }
              }, FLOW_RESPONSE_TIMEOUT_MS);
            });

            // B-03: if trigger() throws, clean up the pending entry immediately
            try {
              await card.trigger(
                { tool_name: toolName, tool_input: args.input || '' },
                { flow_id: id, request_id: requestId, tool_name: toolName, tool_input: args.input || '' },
              );
            } catch (err) {
              if (this._pendingResponses.has(requestId)) {
                this._pendingResponses.delete(requestId);
              }
              throw err;
            }

            const { text, isError } = await responsePromise;
            if (isError) throw new Error(text);
            return text;
          },
        );
          count++;
        } catch (err) {
          // B-07: one bad flow must not abort registration of the rest
          this.log(`[HomeyMCP] Skipping flow "${flow?.name || id}": ${err.message}`);
        }
      }

      if (count > 0) {
        this.log(`[HomeyMCP] Registered ${count} flow trigger tool(s)`);
      }
    } catch (err) {
      this.log(`[HomeyMCP] Flow tools registration skipped: ${err.message}`);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  async _getLocalAddress() {
    const configured = this.homey.settings.get('local_address');
    if (configured && configured !== '127.0.0.1') return configured;
    try {
      if (this.homey.cloud?.getLocalAddress) {
        const addr = await this.homey.cloud.getLocalAddress();
        if (addr) {
          return addr.split(':')[0];
        }
      }
    } catch (_) {}
    return '127.0.0.1';
  }

  // ─── API endpoints for settings page ────────────────────────────

  async getSettings({ homey, query }) {
    const mcpUrl = this.homey.settings.get('mcp_url') || '';
    let localIp = this.homey.settings.get('local_address') || '';
    if (!localIp && mcpUrl) {
      try { localIp = new URL(mcpUrl).hostname; } catch (_) {}
    }
    return {
      port:          this.homey.settings.get('port')          || DEFAULT_PORT,
      local_address: this.homey.settings.get('local_address') || '',
      local_ip:      localIp,
      mcp_url:       mcpUrl || null,
      status:        this.homey.settings.get('status')        || 'running',
      tool_count:    this._mcpServer ? this._mcpServer.tools.size    : 0,
      session_count: this._mcpServer ? this._mcpServer.sessions.size : 0,
      has_pat:       !!(this.homey.settings.get('personal_access_token')),
      has_api_key:   !!(this.homey.settings.get('api_key')),
      ip_whitelist:  this.homey.settings.get('ip_whitelist') || '',
      rate_limit:    this.homey.settings.get('rate_limit')   || 0,
    };
  }

  async postSettings({ homey, body }) {
    const { port, local_address, personal_access_token, api_key, ip_whitelist, rate_limit } = body || {};
    let needsRestart = false;

    if (port)                        { this.homey.settings.set('port',          parseInt(port, 10)); needsRestart = true; }
    if (local_address !== undefined) { this.homey.settings.set('local_address', local_address || ''); needsRestart = true; }
    if (personal_access_token !== undefined) {
      this.homey.settings.set('personal_access_token', personal_access_token || '');
    }
    if (api_key !== undefined) {
      this.homey.settings.set('api_key', api_key || '');
      // Takes effect immediately via the getApiKey callback
    }
    if (ip_whitelist !== undefined) {
      this.homey.settings.set('ip_whitelist', ip_whitelist || '');
      // Takes effect immediately via the getIpWhitelist callback
    }
    if (rate_limit !== undefined) {
      this.homey.settings.set('rate_limit', parseInt(rate_limit, 10) || 0);
      // Takes effect immediately via the getRateLimit callback
    }
    if (needsRestart) {
      await this._stopServer();
      await this._startServer();
    }
    return { success: true };
  }

  async getStatus({ homey, query }) {
    return {
      status:        this.homey.settings.get('status')    || 'running',
      mcp_url:       this.homey.settings.get('mcp_url')   || null,
      port:          this.homey.settings.get('port')       || DEFAULT_PORT,
      tool_count:    this._mcpServer ? this._mcpServer.tools.size    : 0,
      session_count: this._mcpServer ? this._mcpServer.sessions.size : 0,
    };
  }

}

module.exports = HomeyMcpApp;
