MCP AI Bridge connects any AI agent (Claude, Cursor, Windsurf, GPT-4...) to your Homey Pro via the Model Context Protocol (MCP). Give commands in plain language and let AI control your smart home — no programming required.

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

Plus: your own custom tools built from Homey flows (see below)

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

CUSTOM AI TOOLS VIA FLOW CARDS

MCP AI Bridge adds three flow cards so you can build your own AI tools entirely in the Homey flow editor:

ALS (When):   "AI agent calls tool [tool_name]"
              Fires when your AI agent calls a custom tool.
              Tokens available: tool_name, tool_input

EN (And):     "The tool name is / is not [name]"
              Filter which tool name triggers this branch.
              Useful when one flow handles multiple tools.

DAN (Then):   "Return [response] to the AI agent"
              Sends a real text response back to the AI.
              Supports flow tokens — use {{tool_input}}, device values, etc.

EXAMPLE FLOW:
  ALS: AI agent calls a custom tool
  EN:  Tool name is "get_weather"
  DAN: [call a weather action card]
  DAN: Return "The temperature is {{temperature}} degrees" to the AI agent

The AI waits up to 10 seconds for a response. If no "Return response" card is used, it gets a default "triggered successfully" message.

After creating a flow with the ALS trigger card, restart MCP AI Bridge — the flow appears automatically as an MCP tool named flow_[flowname].

---

OPENAPI SPEC AND REST SHORTCUTS

Every tool is also accessible as a plain REST endpoint:
  GET  http://[homey-ip]:52199/openapi.json   — full OpenAPI 3.1 spec
  POST http://[homey-ip]:52199/tools/{name}   — call any tool directly
  GET  http://[homey-ip]:52199/health         — server health check
  GET  http://[homey-ip]:52199/info           — server info and tool list

This lets you integrate MCP AI Bridge into any HTTP-capable system without an MCP client.

---

API KEY AUTHENTICATION (optional)

Protect access to your MCP server with an API key. Set one in the app settings.
AI clients include it via: Authorization: Bearer <key>  or  X-API-Key: <key>

Without a key, the server trusts your local network (default).

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

TECHNICAL

Protocol: MCP 2025-03-26 (StreamableHTTP + JSON-RPC 2.0)
Default port: 52199 (configurable in settings)
Authentication: optional API key (Bearer or X-API-Key header)
Open-source: https://github.com/weide43/homey-mcp-server
