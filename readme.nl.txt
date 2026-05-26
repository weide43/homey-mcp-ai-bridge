MCP AI Bridge verbindt elke AI-agent (Claude, Cursor, Windsurf, GPT-4...) met je Homey Pro via het Model Context Protocol (MCP). Geef opdrachten in gewone taal en laat de AI je slimme huis bedienen, geen programmeerkennis vereist.

---

WAT KAN JE DOEN?

Stuur gewone opdrachten naar je AI-assistent:
- "Zet alle lampen in de woonkamer uit"
- "Maak een flow die elke dag om 7:30 het licht aanzet"
- "Hoeveel energie heb ik deze week verbruikt?"
- "Zet de variabele Vakantie op aan"
- "Wat zijn de temperaturen in alle kamers?"

---

80+ TOOLS BESCHIKBAAR

Apparaten (10): lijst, details, capabilities lezen/instellen, hernoemen, verplaatsen, hele zone tegelijk bedienen
Zones (5): aanmaken, aanpassen, verwijderen
Flows (14): basis- en geavanceerde flows, aanmaken/aanpassen/triggeren/in-uitschakelen/verwijderen
Flow Cards en mappen (7): beschikbare triggers/condities/acties opvragen, uitvoeren, mapbeheer
Logica-variabelen (5): aanmaken, lezen, instellen, verwijderen
Inzichten (2): historische data en logs opvragen
Notificaties (3): versturen, lijst opvragen, verwijderen
Apps (9): lijst, details, in-/uitschakelen, herstarten, updaten, instellingen lezen/schrijven
Gebruikers en aanwezigheid (6): wie is thuis, thuis/weg instellen, slaapstatus
Wekkers (5): aanmaken, aanpassen, verwijderen
Energie (3): live verbruik, kosten per kWh
Audio (2): systeemvolume lezen/instellen
Systeem (8): info, geheugen, opslag, hernoemen, herstarten, tekst-naar-spraak, LED-ring, actieve sessies

Plus: eigen tools gebouwd vanuit Homey flows (zie hieronder)

---

VERBINDEN MET JE AI-AGENT

Na installatie vind je de MCP URL op de instellingenpagina van de app:
http://[jouw-homey-ip]:52199/mcp

Claude Desktop, voeg toe aan claude_desktop_config.json:
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

Cursor / Windsurf, voeg toe aan mcp.json:
{
  "mcpServers": {
    "homey": {
      "url": "http://[homey-ip]:52199/mcp"
    }
  }
}

---

EIGEN AI-TOOLS VIA FLOW CARDS

MCP AI Bridge voegt acht flow-cards toe waarmee je eigen AI-tools bouwt in de Homey flow-editor:

ALS (3 triggers):

  "AI-agent roept een aangepaste tool aan"
  Wordt geactiveerd wanneer je AI-agent een aangepaste tool aanroept.
  Beschikbare tokens: tool_name, tool_input

  "MCP AI Bridge-server start op"
  Wordt geactiveerd elke keer dat de MCP-server opstart.
  Beschikbare tokens: tool_count, mcp_url

  "Een AI-agent verbindt"
  Wordt geactiveerd wanneer een AI-client een nieuwe sessie opent.
  Beschikbare tokens: session_id, session_count

EN (3 condities):

  "De toolnaam is / is niet [naam]"
  Filter op toolnaam om te bepalen welke tak van de flow loopt.
  Handig als een flow meerdere tools afhandelt.

  "De tool-invoer bevat / bevat niet [tekst]"
  Controleer of de tool-invoer een bepaalde waarde bevat.

  "De tool-invoer is / is niet leeg"
  Controleer of er invoer is meegegeven aan de tool.

DAN (2 acties):

  "Stuur [antwoord] terug naar de AI-agent"
  Geeft een echt tekstantwoord terug aan de AI.
  Ondersteunt flow-tokens: gebruik {{tool_input}}, apparaatwaarden, etc.

  "Stuur fout [bericht] terug naar de AI-agent"
  Stuurt een foutantwoord terug naar de AI.
  De AI ontvangt het bericht als toolsfout.

VOORBEELDFLOW:
  ALS: AI-agent roept een aangepaste tool aan
  EN:  Toolnaam is "get_weather"
  DAN: [weersactie uitvoeren]
  DAN: Stuur "De temperatuur is {{temperature}} graden" terug naar de AI-agent

De AI wacht tot 10 seconden op een antwoord. Zonder "Stuur antwoord terug"-kaart krijgt de AI een standaardbericht "flow triggered successfully".

Na het aanmaken van een flow met de ALS-triggerkaart: herstart MCP AI Bridge. De flow verschijnt automatisch als MCP-tool met de naam flow_[flownaam].

---

OPENAPI-SPEC EN REST-SNELKOPPELINGEN

Elke tool is ook beschikbaar als gewone REST-aanroep:
  GET  http://[homey-ip]:52199/openapi.json   - volledige OpenAPI 3.1-spec
  POST http://[homey-ip]:52199/tools/{naam}   - roep elke tool direct aan
  GET  http://[homey-ip]:52199/health         - serverstatus
  GET  http://[homey-ip]:52199/info           - serverinfo en toollijst

Zo kun je MCP AI Bridge integreren in elk HTTP-systeem zonder MCP-client.

---

API-SLEUTEL BEVEILIGING (optioneel)

Beveilig toegang tot je MCP-server met een API-sleutel. Stel in via de app-instellingen.
AI-clients sturen mee via: Authorization: Bearer <sleutel>  of  X-API-Key: <sleutel>

Zonder sleutel vertrouwt de server je lokale netwerk (standaard).

---

IP-WHITELIST EN RATELIMITING (optioneel)

Beperk welke IP-adressen verbinding kunnen maken met de MCP-server:
- Vul een kommagescheiden lijst van toegestane IP-adressen in (bv. 192.168.1.10, 192.168.1.20)
- Gebruik * om alle IP-adressen toe te staan (standaard)
- Het /health-eindpunt is altijd toegankelijk, ongeacht de whitelist

Beperk het aantal aanvragen per IP per minuut:
- Stel een maximumaantal aanvragen in via de app-instellingen
- Clients die de limiet overschrijden krijgen HTTP 429 (te veel aanvragen)
- Stel in op 0 om ratelimiting uit te schakelen

Beide instellingen zijn direct van kracht, herstarten is niet nodig.

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
Broncode: https://github.com/weide43/homey-mcp-ai-bridge
