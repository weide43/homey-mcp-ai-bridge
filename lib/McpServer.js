'use strict';

const http   = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const MCP_VERSION    = '2025-03-26';
const SERVER_NAME    = 'MCP AI Bridge';
const SERVER_VERSION = '1.4.1';

/**
 * McpServer - Implements the Model Context Protocol over HTTP
 *
 * Transport: StreamableHTTP (MCP spec 2025-03-26)
 *   POST   /mcp           -> JSON-RPC handler (MCP)
 *   GET    /mcp           -> SSE stream
 *   DELETE /mcp           -> Close session
 *   GET    /health        -> Health check (always public)
 *   GET    /info          -> Server info and tool list
 *   GET    /openapi.json  -> OpenAPI 3.1 spec for all tools
 *   POST   /tools/:name   -> REST shortcut - call any tool without MCP
 *
 * Security (all optional, configured via Homey settings):
 *   API key   - Bearer token or X-API-Key header
 *   IP whitelist - comma-separated list of allowed client IPs
 *   Rate limit   - max requests per IP per minute
 */
class McpServer extends EventEmitter {

  constructor({ port = 52199, tools = new Map(), log, getApiKey, getIpWhitelist, getRateLimit }) {
    super();
    this.port           = port;
    this.tools          = tools;
    this.sessions       = new Map();
    this.log            = log || console;
    this.server         = null;
    this.getApiKey      = getApiKey      || (() => null);
    this.getIpWhitelist = getIpWhitelist || (() => null);
    this.getRateLimit   = getRateLimit   || (() => null);
    this._rateLimiters  = new Map(); // ip -> { count, resetAt }
    this._cleanupTimer  = null;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────

  start() {
    return new Promise((resolve, reject) => {
      this._sockets = new Set();

      // Periodically purge expired rate-limit entries to avoid memory growth
      this._cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of this._rateLimiters) {
          if (now > entry.resetAt) this._rateLimiters.delete(ip);
        }
      }, 60000);

      this.server = http.createServer((req, res) => {
        this._handleRequest(req, res).catch(err => {
          this.log.error(`[MCP] Unhandled error: ${err.message}`);
          if (!res.headersSent) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });

      this.server.on('connection', socket => {
        this._sockets.add(socket);
        socket.once('close', () => this._sockets.delete(socket));
      });

      this.server.on('error', err => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.port} is already in use. Change the port in settings.`));
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, '0.0.0.0', () => {
        this.log.log(`[MCP] Server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  stop() {
    return new Promise(resolve => {
      if (this._cleanupTimer) {
        clearInterval(this._cleanupTimer);
        this._cleanupTimer = null;
      }

      // Close all SSE sessions and emit closed events
      for (const [sessionId, session] of this.sessions) {
        try { session.res.end(); } catch (_) {}
        this.emit('session:closed', { sessionId, count: 0 });
      }
      this.sessions.clear();

      if (this.server) {
        if (this._sockets) {
          for (const socket of this._sockets) {
            try { socket.destroy(); } catch (_) {}
          }
          this._sockets.clear();
        }
        // B-01: single resolve path — no setTimeout race
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // ─── Request routing ─────────────────────────────────────────────

  async _handleRequest(req, res) {
    this._setCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, 'http://localhost');

    // /health is always public — no auth, whitelist or rate limit
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status:   'ok',
        name:     SERVER_NAME,
        version:  SERVER_VERSION,
        tools:    this.tools.size,
        sessions: this.sessions.size,
      }));
      return;
    }

    // IP whitelist check
    if (!this._checkIpWhitelist(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden. Your IP address is not on the whitelist.' }));
      return;
    }

    // API key check
    if (!this._checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Unauthorized. Provide your API key via "Authorization: Bearer <key>" or "X-API-Key: <key>".',
      }));
      return;
    }

    // Rate limit check
    if (!this._checkRateLimit(req)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many requests. Please slow down.' }));
      return;
    }

    // Route
    if (url.pathname === '/mcp') {
      if      (req.method === 'POST')   await this._handlePost(req, res, url);
      else if (req.method === 'GET')    this._handleSse(req, res, url);
      else if (req.method === 'DELETE') this._handleDelete(req, res, url);
      else { res.writeHead(405); res.end(); }

    } else if (url.pathname === '/info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name:       SERVER_NAME,
        version:    SERVER_VERSION,
        mcpVersion: MCP_VERSION,
        tools:      this._getToolsList(),
        sessions:   this.sessions.size,
        connect:    `POST http://[homey-ip]:${this.port}/mcp`,
        openapi:    `GET  http://[homey-ip]:${this.port}/openapi.json`,
      }));

    } else if (url.pathname === '/openapi.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this._buildOpenApiSpec()));

    } else {
      // REST shortcut: POST /tools/:name
      const toolMatch = url.pathname.match(/^\/tools\/([^/]+)$/);
      if (toolMatch && req.method === 'POST') {
        await this._handleRestTool(req, res, toolMatch[1]);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    }
  }

  // ─── Auth ────────────────────────────────────────────────────────

  _checkAuth(req) {
    const apiKey = this.getApiKey();
    if (!apiKey) return true;
    const auth      = req.headers['authorization'] || '';
    const keyHeader = req.headers['x-api-key']     || '';
    return (auth === `Bearer ${apiKey}`) || (keyHeader === apiKey);
  }

  // ─── IP Whitelist ─────────────────────────────────────────────────

  _getClientIp(req) {
    // S-01: never trust X-Forwarded-For — the server binds directly to the LAN
    // and has no trusted reverse proxy. Always use the real socket address.
    return (req.socket?.remoteAddress || '').replace('::ffff:', '');
  }

  _checkIpWhitelist(req) {
    const whitelist = this.getIpWhitelist();
    if (!whitelist) return true; // no whitelist = allow all
    const ip      = this._getClientIp(req);
    const allowed = whitelist.split(',').map(s => s.trim()).filter(Boolean);
    return allowed.some(w => w === '*' || w === ip);
  }

  // ─── Rate Limiting ────────────────────────────────────────────────

  _checkRateLimit(req) {
    const limit = this.getRateLimit();
    if (!limit || limit <= 0) return true; // no limit configured
    const ip      = this._getClientIp(req);
    const now     = Date.now();
    const windowMs = 60000; // 1-minute sliding window

    let entry = this._rateLimiters.get(ip);
    if (!entry || now > entry.resetAt) {
      this._rateLimiters.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  }

  // ─── POST /mcp ───────────────────────────────────────────────────

  async _handlePost(req, res, url) {
    const body = await this._readBody(req);
    let message;
    try {
      message = JSON.parse(body);
    } catch (_) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this._jsonError(null, -32700, 'Parse error')));
      return;
    }

    if (Array.isArray(message)) {
      // S-07: cap batch size to prevent resource exhaustion
      if (message.length > 20) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this._jsonError(null, -32600, 'Batch too large (max 20 messages)')));
        return;
      }
      const results   = await Promise.all(message.map(m => this._processMessage(m)));
      const responses = results.filter(Boolean);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responses));
      return;
    }

    const response = await this._processMessage(message);
    if (response === null) {
      res.writeHead(202);
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  // ─── REST tool shortcut: POST /tools/:name ───────────────────────

  async _handleRestTool(req, res, toolName) {
    const body = await this._readBody(req);
    let args = {};
    try { if (body) args = JSON.parse(body); } catch (_) {}

    const tool = this.tools.get(toolName);
    if (!tool) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Unknown tool: "${toolName}". GET /openapi.json for the full list.` }));
      return;
    }

    try {
      const result = await tool.handler(args);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        tool:   toolName,
        result: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  // ─── JSON-RPC message processor ──────────────────────────────────

  async _processMessage(msg) {
    const { jsonrpc, id, method, params } = msg;

    if (jsonrpc !== '2.0') {
      return this._jsonError(id, -32600, 'Invalid Request: jsonrpc must be "2.0"');
    }

    if (id === undefined) {
      this._handleNotification(method, params);
      return null;
    }

    try {
      switch (method) {
        case 'initialize':
          return this._jsonResult(id, {
            protocolVersion: MCP_VERSION,
            capabilities: { tools: {}, logging: {} },
            serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          });

        case 'initialized':
          return null;

        case 'ping':
          return this._jsonResult(id, {});

        case 'tools/list':
          return this._jsonResult(id, { tools: this._getToolsList() });

        case 'tools/call':
          return await this._callTool(id, params);

        case 'resources/list':
          return this._jsonResult(id, { resources: [] });

        case 'prompts/list':
          return this._jsonResult(id, { prompts: [] });

        case 'logging/setLevel':
          return this._jsonResult(id, {});

        default:
          return this._jsonError(id, -32601, `Method not found: ${method}`);
      }
    } catch (err) {
      this.log.error(`[MCP] Error processing ${method}: ${err.message}`);
      return this._jsonError(id, -32603, `Internal error: ${err.message}`);
    }
  }

  // ─── Tool execution ──────────────────────────────────────────────

  async _callTool(id, params) {
    const name = params?.name;
    const args = params?.arguments || {};

    if (!name) {
      return this._jsonError(id, -32602, 'Missing tool name');
    }

    const tool = this.tools.get(name);
    if (!tool) {
      return this._jsonError(id, -32602, `Unknown tool: "${name}". Use tools/list to see available tools.`);
    }

    try {
      const result = await tool.handler(args);
      return this._jsonResult(id, {
        content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
        isError: false,
      });
    } catch (err) {
      this.log.error(`[MCP] Tool "${name}" failed: ${err.message}`);
      return this._jsonResult(id, {
        content: [{ type: 'text', text: `Error executing tool "${name}": ${err.message}` }],
        isError: true,
      });
    }
  }

  // ─── SSE stream (GET /mcp) ───────────────────────────────────────

  _handleSse(req, res, url) {
    const sessionId = this._generateId();

    res.writeHead(200, {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'Connection':        'keep-alive',
      'Mcp-Session-Id':    sessionId,
      'X-Accel-Buffering': 'no',
    });

    res.write(`event: endpoint\ndata: /mcp?session=${sessionId}\n\n`);
    this.sessions.set(sessionId, { res, createdAt: Date.now() });
    this.log.log(`[MCP] SSE session opened: ${sessionId}`);

    // Notify app so it can fire the mcp_agent_connected flow card
    this.emit('session:opened', { sessionId, count: this.sessions.size });

    const pingInterval = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (_) { clearInterval(pingInterval); }
    }, 30000);

    req.on('close', () => {
      clearInterval(pingInterval);
      this.sessions.delete(sessionId);
      this.log.log(`[MCP] SSE session closed: ${sessionId}`);
      this.emit('session:closed', { sessionId, count: this.sessions.size });
    });
  }

  // ─── DELETE (close session) ──────────────────────────────────────

  _handleDelete(req, res, url) {
    const sessionId = req.headers['mcp-session-id'] || url.searchParams.get('session');
    if (sessionId && this.sessions.has(sessionId)) {
      const { res: sseRes } = this.sessions.get(sessionId);
      try { sseRes.end(); } catch (_) {}
      this.sessions.delete(sessionId);
      this.log.log(`[MCP] Session terminated: ${sessionId}`);
      this.emit('session:closed', { sessionId, count: this.sessions.size });
      res.writeHead(200);
    } else {
      // B-11: return 404 for unknown/already-closed sessions
      res.writeHead(sessionId ? 404 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: sessionId ? 'Session not found' : 'Missing session ID' }));
      return;
    }
    res.end();
  }

  // ─── Notification handler ────────────────────────────────────────

  _handleNotification(method, params) {
    if (method === 'notifications/initialized') {
      this.log.log('[MCP] Client initialized');
    }
  }

  // ─── Push notification to SSE sessions ──────────────────────────

  pushNotification(method, params) {
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params });
    const failed = [];
    for (const [id, { res }] of this.sessions) {
      try {
        res.write(`event: message\ndata: ${msg}\n\n`);
      } catch (_) {
        failed.push(id);
      }
    }
    // B-09: clean up dead sessions after iteration, not during
    for (const id of failed) {
      const session = this.sessions.get(id);
      if (session) {
        try { session.res.end(); } catch (_) {}
      }
      this.sessions.delete(id);
      this.emit('session:closed', { sessionId: id, count: this.sessions.size });
    }
  }

  // ─── OpenAPI spec builder ────────────────────────────────────────

  _buildOpenApiSpec() {
    const paths = {};

    for (const [name, tool] of this.tools) {
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
      paths[`/tools/${safeName}`] = {
        post: {
          operationId: safeName,
          summary:     tool.description,
          tags:        ['tools'],
          requestBody: {
            required: false,
            content: {
              'application/json': { schema: tool.inputSchema || { type: 'object' } },
            },
          },
          responses: {
            200: {
              description: 'Tool executed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tool:   { type: 'string' },
                      result: { type: 'string' },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized - API key required' },
            403: { description: 'Forbidden - IP not on whitelist' },
            404: { description: 'Tool not found' },
            429: { description: 'Too many requests' },
            500: { description: 'Tool execution error' },
          },
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        },
      };
    }

    return {
      openapi: '3.1.0',
      info: {
        title:       `${SERVER_NAME} REST API`,
        version:     SERVER_VERSION,
        description: `REST shortcut for all ${this.tools.size} MCP tools. POST to /tools/{name} with a JSON body.`,
      },
      servers: [{ url: `http://[homey-ip]:${this.port}` }],
      components: {
        securitySchemes: {
          BearerAuth: { type: 'http', scheme: 'bearer' },
          ApiKeyAuth:  { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        },
      },
      paths,
    };
  }

  // ─── Tool registry helpers ───────────────────────────────────────

  registerTool(name, description, inputSchema, handler) {
    this.tools.set(name, { name, description, inputSchema, handler });
  }

  _getToolsList() {
    return Array.from(this.tools.values()).map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));
  }

  // ─── Utilities ───────────────────────────────────────────────────

  _setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', [
      'Content-Type', 'Authorization', 'X-API-Key', 'Mcp-Session-Id', 'Accept',
    ].join(', '));
  }

  _readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        // S-06: enforce 1 MB body limit to prevent DoS
        if (body.length > 1_048_576) {
          req.destroy();
          reject(new Error('Payload too large (max 1 MB)'));
        }
      });
      req.on('end',  () => resolve(body));
      req.on('error', reject);
    });
  }

  _jsonResult(id, result) { return { jsonrpc: '2.0', id, result }; }
  _jsonError(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }
  // S-08: use CSPRNG instead of Math.random() for session IDs
  _generateId() { return crypto.randomBytes(16).toString('hex'); }

}

module.exports = McpServer;
