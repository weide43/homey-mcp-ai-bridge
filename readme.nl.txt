Synapse MCP verbindt elke AI-agent (Claude, Cursor, Windsurf, GPT-4...) met je Homey Pro via het Model Context Protocol (MCP). Geef opdrachten in gewone taal en laat de AI je slimme huis bedienen — zonder programmeren.

---

WAT KAN JE DOEN?

Stuur gewone opdrachten naar je AI-assistent:
- "Zet alle lampen in de woonkamer uit"
- "Maak een flow die elke dag om 7:30 het licht aanzet"
- "Hoeveel energie heb ik deze week verbruikt?"
- "Zet de variabele Vakantie op aan"
- "Wat zijn de temperaturen in alle kamers?"

---

83+ TOOLS BESCHIKBAAR

Apparaten (10): lijst, details, capabilities lezen/instellen, hernoemen, verplaatsen, hele zone tegelijk bedienen
Zones (5): aanmaken, aanpassen, verwijderen
Flows (9): aanmaken, aanpassen, triggeren, in-/uitschakelen, verwijderen
Advanced Flows (6): aanmaken, aanpassen, triggeren, in-/uitschakelen, verwijderen
Flow mappen (4): aanmaken, hernoemen, verwijderen
Flow cards (5): beschikbare triggers/condities/acties opvragen en uitvoeren
Logica-variabelen (5): aanmaken, lezen, instellen, verwijderen
Inzichten (2): historische data en logs opvragen
Notificaties (3): versturen, lijst opvragen, verwijderen
Apps (9): lijst, details, in-/uitschakelen, herstarten, updaten, instellingen lezen/schrijven
Gebruikers & aanwezigheid (6): wie is thuis, thuis/weg instellen, slaapstatus
Wekkers (5): aanmaken, aanpassen, verwijderen
Energie (3): live verbruik, kosten per kWh
Audio (2): systeemvolume lezen/instellen
Systeem (6): info, geheugen, opslag, hernoemen, herstarten
Spraak & LED (2): tekst-naar-spraak, LED-ring animeren

Plus: eigen tools via je Homey flows (zie Flow Tools hieronder)

---

VERBINDEN MET JE AI-AGENT

Na installatie vind je de MCP URL op de instellingenpagina van de app:
http://[jouw-homey-ip]:52199/mcp

Claude Desktop — voeg toe aan claude_desktop_config.json:
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

Cursor / Windsurf — voeg toe aan mcp.json:
{
  "mcpServers": {
    "homey": {
      "url": "http://[homey-ip]:52199/mcp"
    }
  }
}

---

API-SLEUTEL BEVEILIGING (optioneel)

Beveilig toegang tot je MCP-server met een API-sleutel. Stel deze in via de app-instellingen.
AI-clients sturen de sleutel mee via: Authorization: Bearer <sleutel>

Zonder API-sleutel vertrouwt de server je lokale netwerk (standaard).

---

FLOW TOOLS (maak eigen AI-tools via flows)

Je kunt elke Homey flow beschikbaar maken als AI-tool:

1. Maak een flow aan in Homey
2. Gebruik de triggerkaart "AI-agent roept een aangepaste tool aan" als trigger
3. Herstart de Synapse MCP-app
4. De flow verschijnt als MCP-tool die je AI kan aanroepen

De AI ontvangt een bevestiging wanneer de flow getriggerd wordt. Gebruik actikaarten in de flow voor alles: notificaties versturen, apparaten bedienen, scripts starten, of andere flows starten.

---

OPENAPI-SPEC EN REST-SNELKOPPELINGEN

Elke tool is ook beschikbaar als gewone REST-aanroep:
  GET  http://[homey-ip]:52199/openapi.json   — volledige OpenAPI 3.1-spec
  POST http://[homey-ip]:52199/tools/{naam}   — roep elke tool direct aan

Zo kun je Synapse MCP integreren in elk HTTP-systeem, ook zonder MCP-client.

---

PERSONAL ACCESS TOKEN (optioneel)

De meeste tools werken zonder token. Alleen voor het aanmaken, wijzigen of verwijderen van flows (basis, geavanceerd en mappen) is een Personal Access Token nodig:

1. Ga naar my.homey.app > Instellingen > API
2. Maak een token aan met de homey.flow scope
3. Plak het token in de app-instellingen
4. Herstart de app

---

VEREISTEN

- Homey Pro (2016, 2019, 2023 of 2026)
- Homey firmware 5.0.0 of hoger
- Homey Cloud wordt NIET ondersteund

---

TECHNISCH

Protocol: MCP 2025-03-26 (StreamableHTTP + JSON-RPC 2.0)
Standaard poort: 52199 (aanpasbaar in instellingen)
Authenticatie: optionele API-sleutel (Bearer of X-API-Key header)
Extra endpoints: GET /openapi.json, POST /tools/:name, GET /health, GET /info
Broncode: https://github.com/weide43/homey-mcp-server
