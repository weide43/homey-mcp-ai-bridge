'use strict';

const Homey = require('homey');
const { HomeyAPI } = require('homey-api');
const McpServer = require('./lib/McpServer');
const HomeySDKClient = require('./lib/HomeySDKClient');
const { registerAllTools } = require('./lib/tools/index');

const DEFAULT_PORT = 52199;

class HomeyMcpApp extends Homey.App {

  async onInit() {
    this.log('[HomeyMCP] App starting...');
    await this._startServer();
    this.log('[HomeyMCP] App ready.');
  }

  async onUninit() {
    await this._stopServer();
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

    // Create MCP server with optional API key authentication
    this._mcpServer = new McpServer({
      port,
      log: this,
      getApiKey: () => this.homey.settings.get('api_key') || null,
    });

    // Register built-in tools
    registerAllTools(this._mcpServer, this._client, this.homey);

    // Register flow-defined tools (flows using the mcp_flow_tool trigger card)
    await this._registerFlowTools();

    // Start listening
    try {
      await this._mcpServer.start();
      const address = await this._getLocalAddress();
      const url = `http://${address}:${port}/mcp`;

      this.log(`[HomeyMCP] MCP server running at ${url} (${this._mcpServer.tools.size} tools)`);
      this.homey.settings.set('status',     'running');
      this.homey.settings.set('mcp_url',    url);
      this.homey.settings.set('tool_count', this._mcpServer.tools.size);
    } catch (err) {
      this.log(`[HomeyMCP] Failed to start server: ${err.message}`);
      this.homey.settings.set('status', `Error: ${err.message}`);
    }
  }

  async _stopServer() {
    if (this._mcpServer) {
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
        // Only register flows that use the mcp_flow_tool trigger card
        const triggerId = flow.trigger && flow.trigger.id;
        if (triggerId !== 'mcp_flow_tool' && triggerId !== 'community.synapse-mcp:mcp_flow_tool') continue;

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
            await card.trigger(
              { tool_name: toolName, tool_input: args.input || '' },
              { flow_id: id },
            );
            return `Flow "${flowName}" triggered successfully`;
          },
        );
        count++;
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
          // Strip any port suffix (e.g. "192.168.2.178:80" → "192.168.2.178")
          return addr.split(':')[0];
        }
      }
    } catch (_) {}
    return '127.0.0.1';
  }

  // ─── API endpoints for settings page ────────────────────────────

  async getSettings({ homey, query }) {
    // Handle PAT save via GET query param (POST is blocked by CORS preflight)
    if (query && query.savepat !== undefined) {
      this.homey.settings.set('personal_access_token', query.savepat || '');
      return { success: true };
    }

    const mcpUrl = this.homey.settings.get('mcp_url') || '';
    // Extract the hostname from the stored mcp_url so the settings page can auto-fill the IP
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
      tool_count:    this._mcpServer ? this._mcpServer.tools.size : 0,
      has_pat:       !!(this.homey.settings.get('personal_access_token')),
      has_api_key:   !!(this.homey.settings.get('api_key')),
    };
  }

  async postSettings({ homey, body }) {
    const { port, local_address, personal_access_token, api_key } = body || {};
    let needsRestart = false;
    if (port)                        { this.homey.settings.set('port',          parseInt(port, 10)); needsRestart = true; }
    if (local_address !== undefined) { this.homey.settings.set('local_address', local_address || ''); needsRestart = true; }
    if (personal_access_token !== undefined) {
      this.homey.settings.set('personal_access_token', personal_access_token || '');
      // PAT takes effect on next app restart
    }
    if (api_key !== undefined) {
      this.homey.settings.set('api_key', api_key || '');
      // API key takes effect immediately via the getApiKey callback
    }
    if (needsRestart) {
      await this._stopServer();
      await this._startServer();
    }
    return { success: true };
  }

  async getToken({ homey, query }) {
    if (query.token !== undefined) {
      this.homey.settings.set('personal_access_token', query.token || '');
    }
    return { success: true };
  }

  async getStatus({ homey, query }) {
    return {
      status:     this.homey.settings.get('status')    || 'running',
      mcp_url:    this.homey.settings.get('mcp_url')   || null,
      port:       this.homey.settings.get('port')       || DEFAULT_PORT,
      tool_count: this._mcpServer ? this._mcpServer.tools.size    : 0,
      sessions:   this._mcpServer ? this._mcpServer.sessions.size : 0,
    };
  }

}

module.exports = HomeyMcpApp;
