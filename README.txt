MCP AI Bridge connects any AI agent (Claude, Cursor, Windsurf, GPT-4...) to your Homey Pro via the Model Context Protocol (MCP). Give commands in plain language and let AI control your smart home, no programming required.

---

WHAT CAN YOU DO?

Send plain commands to your AI assistant:
- "Turn off all lights in the living room"
- "Create a flow that turns on the kitchen light every day at 7:30"
- "How much energy did I use this week?"
- "Set the variable Vacation to true"
- "What are the temperatures in all rooms?"

---

80+ TOOLS AVAILABLE

Devices (10): list, details, read/set capabilities, rename, move, control entire zones at once
Zones (5): create, update, delete
Flows (14): basic flows and advanced flows, create/update/trigger/enable/delete
Flow Cards and Folders (7): browse triggers/conditions/actions, run cards, folder management
Logic Variables (5): create, read, set, delete
Insights (2): query historical data and logs
Notifications (3): send, list, delete
Apps (9): list, details, enable/disable, restart, update, read/write settings
Users and Presence (6): who is home, set home/away, sleep state
Alarms (5): create, update, delete
Energy (3): live usage, cost per kWh
Audio (2): read/set system volume
System (8): info, memory, storage, rename, reboot, text-to-speech, LED ring, active sessions

Plus: your own custom tools built from Homey flows (see below)

---

HOW TO CONNECT YOUR AI AGENT

After installation, find your MCP URL on the app settings page:
http://[your-homey-ip]:52199/mcp

Claude Desktop, add to claude_desktop_config.json:
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

Cursor / Windsurf, add to mcp.json:
{
  "mcpServers": {
    "homey": {
      "url": "http://[homey-ip]:52199/mcp"
    }
  }
}

---

CUSTOM AI TOOLS VIA FLOW CARDS

MCP AI Bridge adds eight flow cards so you can build your own AI tools entirely in the Homey flow editor:

WHEN (3 triggers):

  "AI agent calls a custom tool"
  Fires when your AI agent calls a custom tool.
  Tokens available: tool_name, tool_input

  "MCP AI Bridge server starts"
  Fires every time the MCP server starts up.
  Tokens available: tool_count, mcp_url

  "An AI agent connects"
  Fires when an AI client opens a new session.
  Tokens available: session_id, session_count

AND (3 conditions):

  "The tool name is / is not [name]"
  Filter which tool name triggers this branch.
  Useful when one flow handles multiple tools.

  "The tool input contains / does not contain [text]"
  Check whether the tool input includes a specific value.

  "The tool input is / is not empty"
  Check whether any input was passed to the tool.

THEN (2 actions):

  "Return [response] to the AI agent"
  Sends a real text response back to the AI.
  Supports flow tokens: use {{tool_input}}, device values, etc.

  "Return error [message] to the AI agent"
  Sends an error response back to the AI.
  The AI receives the message as a tool error.

EXAMPLE FLOW:
  WHEN: AI agent calls a custom tool
  AND:  Tool name is "get_weather"
  THEN: [call a weather action card]
  THEN: Return "The temperature is {{temperature}} degrees" to the AI agent

The AI waits up to 10 seconds for a response. Without a "Return response" card, it gets a default "flow triggered successfully" message.

After creating a flow with the WHEN trigger card, restart MCP AI Bridge. The flow appears automatically as an MCP tool named flow_[flowname].

---

OPENAPI SPEC AND REST SHORTCUTS

Every tool is also accessible as a plain REST endpoint:
  GET  http://[homey-ip]:52199/openapi.json   - full OpenAPI 3.1 spec
  POST http://[homey-ip]:52199/tools/{name}   - call any tool directly
  GET  http://[homey-ip]:52199/health         - server health check
  GET  http://[homey-ip]:52199/info           - server info and tool list

This lets you integrate MCP AI Bridge into any HTTP-capable system without an MCP client.

---

API KEY AUTHENTICATION (optional)

Protect access to your MCP server with an API key. Set one in the app settings.
AI clients include it via: Authorization: Bearer <key>  or  X-API-Key: <key>

Without a key, the server trusts your local network (default).

---

IP WHITELIST AND RATE LIMITING (optional)

Restrict which IP addresses can connect to the MCP server:
- Enter a comma-separated list of allowed IPs (e.g. 192.168.1.10, 192.168.1.20)
- Use * to allow all IPs (default)
- The /health endpoint is always accessible regardless of the whitelist

Limit the number of requests per IP per minute:
- Set a maximum request count in the app settings
- Clients that exceed the limit receive HTTP 429 (Too Many Requests)
- Set to 0 to disable rate limiting

Both settings take effect immediately, no restart needed.

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
Open-source: https://github.com/weide43/homey-mcp-ai-bridge
