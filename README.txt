Synapse MCP connects any AI agent (Claude, Cursor, Windsurf, GPT-4...) to your Homey Pro via the Model Context Protocol (MCP). Give commands in plain language and let AI control your smart home — no programming required.

---

WHAT CAN YOU DO?

Send plain commands to your AI assistant:
- "Turn off all lights in the living room"
- "Create a flow that turns on the kitchen light every day at 7:30"
- "How much energy did I use this week?"
- "Set the variable Vacation to true"
- "What are the temperatures in all rooms?"

---

83+ TOOLS AVAILABLE

Devices (10): list, details, read/set capabilities, rename, move, control entire zones at once
Zones (5): create, update, delete
Flows (9): create, update, trigger, enable/disable, delete
Advanced Flows (6): create, update, trigger, enable/disable, delete
Flow Folders (4): create, rename, delete
Flow Cards (5): list available triggers/conditions/actions and run them directly
Logic Variables (5): create, read, set, delete
Insights (2): query historical data and logs
Notifications (3): send, list, delete
Apps (9): list, details, enable/disable, restart, update, read/write settings
Users & Presence (6): who is home, set home/away, sleep state
Alarms (5): create, update, delete
Energy (3): live usage, cost per kWh
Audio (2): read/set system volume
System (6): info, memory, storage, rename, reboot
Speech & LED (2): text-to-speech, LED ring animation

Plus: custom tools from your own Homey flows (see Flow Tools below)

---

HOW TO CONNECT YOUR AI AGENT

After installation, find your MCP URL on the app settings page:
http://[your-homey-ip]:52199/mcp

Claude Desktop — add to claude_desktop_config.json:
{
  "mcpServers": {
    "homey": {
      "type": "http",
      "url": "http://[homey-ip]:52199/mcp"
    }
  }
}

Claude Code (terminal):
claude mcp add homey --transport http "http://[homey-ip]:52199/mcp"

Cursor / Windsurf — add to mcp.json:
{
  "mcpServers": {
    "homey": {
      "url": "http://[homey-ip]:52199/mcp"
    }
  }
}

---

API KEY AUTHENTICATION (optional)

Protect access to your MCP server with an API key. Set one in the app settings.
AI clients then include it via: Authorization: Bearer <key>

Without an API key, the server trusts your local network (default).

---

FLOW TOOLS (create your own AI tools via flows)

You can expose any Homey flow as a custom AI tool:

1. Create a flow in Homey
2. Use the trigger card "AI agent calls a custom tool" as the trigger
3. Restart the Synapse MCP app
4. The flow now appears as an MCP tool your AI can call

The AI receives a confirmation when the flow is triggered. Use action cards in the flow to do anything: send notifications, control devices, run scripts, or chain other flows.

---

OPENAPI SPEC AND REST SHORTCUTS

Every tool is also accessible as a plain REST endpoint:
  GET  http://[homey-ip]:52199/openapi.json   — full OpenAPI 3.1 spec
  POST http://[homey-ip]:52199/tools/{name}   — call any tool directly

This lets you integrate Synapse MCP into any HTTP-capable system, even without an MCP client.

---

PERSONAL ACCESS TOKEN (optional)

Most tools work without a token. Only creating, editing or deleting flows (basic, advanced and folders) requires a Personal Access Token:

1. Go to my.homey.app > Settings > API
2. Create a token with the homey.flow scope
3. Paste the token in the app settings
4. Restart the app

---

REQUIREMENTS

- Homey Pro (2016, 2019, 2023 or 2026)
- Homey firmware 5.0.0 or higher
- Homey Cloud is NOT supported

---

WHY SYNAPSE MCP?

Synapse MCP implements the open Model Context Protocol (MCP) standard:

- Works with any MCP-compatible AI client: Claude Desktop, Claude Code, Cursor, Windsurf, Copilot Studio, and more
- 83+ granular tools giving full programmatic access to the Homey API, including advanced flow creation, app settings, insights data, energy monitoring, and system controls
- Extend with your own tools: any Homey flow becomes an AI tool via the flow trigger card
- Optional API key protection for secure remote access
- Full OpenAPI 3.1 spec and REST shortcuts for non-MCP integrations
- Runs entirely on your local network — no cloud dependency, no subscription
- Open-source: https://github.com/weide43/homey-mcp-server

---

TECHNICAL

Protocol: MCP 2025-03-26 (StreamableHTTP + JSON-RPC 2.0)
Default port: 52199 (configurable in settings)
Authentication: optional API key (Bearer or X-API-Key header)
Extra endpoints: GET /openapi.json, POST /tools/:name, GET /health, GET /info
