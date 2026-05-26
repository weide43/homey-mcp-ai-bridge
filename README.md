# MCP AI Bridge

Verbind elke AI-agent (Claude, GPT-4, Cursor, Windsurf...) met je Homey Pro via het **Model Context Protocol (MCP)**. Geef opdrachten in gewone taal en laat AI je slimme huis bedienen, geen programmeerkennis vereist.

---

## Wat is MCP?

Het **Model Context Protocol** is een open standaard waarmee AI-assistenten tools kunnen aanroepen op externe systemen. MCP AI Bridge draait als MCP-server op je Homey Pro. Elke MCP-compatibele AI-client kan er verbinding mee maken.

```
Claude / GPT-4 / Cursor / Windsurf
          ↕ MCP (HTTP)
    Homey Pro (lokaal netwerk)
      └── MCP AI Bridge App
            ├── 80+ tools beschikbaar
            └── Volledige Homey Web API
```

---

## Vereisten

| Vereiste | Versie |
|----------|--------|
| Homey Pro | 2016 / 2019 / 2023 / 2026 |
| Homey firmware | 5.0.0 of hoger |

> Homey Cloud wordt niet ondersteund. De MCP HTTP-server vereist een Homey Pro op je lokale netwerk.

---

## Installatie

### Stap 1: App installeren

**Via de Homey App Store (aanbevolen):**
1. Open de Homey app op je telefoon
2. Ga naar Meer > Apps > App Store
3. Zoek op "MCP AI Bridge"
4. Klik op Installeren

**Via Homey CLI (voor ontwikkelaars):**
```bash
git clone https://github.com/weide43/homey-mcp-ai-bridge
cd homey-mcp-ai-bridge
npm install
homey app run --remote
```

### Stap 2: Verbinden met je AI-agent

Na installatie vind je de MCP URL op de instellingenpagina:
```
http://[jouw-homey-ip]:52199/mcp
```

**Claude Desktop** - voeg toe aan `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "homey": {
      "type": "http",
      "url": "http://[homey-ip]:52199/mcp"
    }
  }
}
```

**Claude Code** (terminal):
```bash
claude mcp add homey --transport http "http://[homey-ip]:52199/mcp"
```

**Cursor / Windsurf** - voeg toe aan `mcp.json`:
```json
{
  "mcpServers": {
    "homey": {
      "url": "http://[homey-ip]:52199/mcp"
    }
  }
}
```

---

## Beschikbare Tools (80+)

| Categorie | Aantal | Mogelijkheden |
|-----------|--------|---------------|
| Apparaten | 10 | lijst, details, capabilities lezen/instellen, hernoemen, zone-controle |
| Zones | 5 | aanmaken, aanpassen, verwijderen |
| Flows | 14 | basis- en geavanceerde flows, CRUD en trigger |
| Flow Cards en mappen | 7 | triggers/condities/acties opvragen, uitvoeren, mapbeheer |
| Logica-variabelen | 5 | aanmaken, lezen, instellen, verwijderen |
| Inzichten | 2 | historische data en logs |
| Notificaties | 3 | versturen, lijst, verwijderen |
| Apps | 9 | in-/uitschakelen, herstarten, updaten, instellingen |
| Gebruikers en aanwezigheid | 6 | wie is thuis, thuis/weg, slaapstatus |
| Wekkers | 5 | aanmaken, aanpassen, verwijderen |
| Energie | 3 | live verbruik, kosten |
| Audio | 2 | volume lezen/instellen |
| Systeem | 8 | info, geheugen, opslag, hernoemen, herstarten, TTS, LED, sessies |

---

## Eigen AI-tools via Flow Cards

MCP AI Bridge voegt acht flow-cards toe. Hiermee bouw je eigen AI-tools volledig in de Homey flow-editor, zonder code.

### ALS (3 triggers)

| Trigger | Beschrijving | Tokens |
|---------|-------------|--------|
| AI-agent roept een aangepaste tool aan | Geactiveerd wanneer de AI een custom tool aanroept | tool_name, tool_input |
| MCP AI Bridge-server start op | Geactiveerd elke keer dat de server opstart | tool_count, mcp_url |
| Een AI-agent verbindt | Geactiveerd wanneer een AI-client een sessie opent | session_id, session_count |

### EN (3 condities)

| Conditie | Beschrijving |
|----------|-------------|
| De toolnaam is / is niet [naam] | Filter op toolnaam |
| De tool-invoer bevat / bevat niet [tekst] | Controleer de inhoud van de invoer |
| De tool-invoer is / is niet leeg | Controleer of er invoer is meegegeven |

### DAN (2 acties)

| Actie | Beschrijving |
|-------|-------------|
| Stuur [antwoord] terug naar de AI-agent | Geeft een tekstantwoord terug, ondersteunt flow-tokens |
| Stuur fout [bericht] terug naar de AI-agent | Stuurt een foutrespons terug naar de AI |

### Voorbeeldflow

```
ALS:  AI-agent roept een aangepaste tool aan
EN:   Toolnaam is "get_weather"
DAN:  [weersactie uitvoeren]
DAN:  Stuur "De temperatuur is {{temperature}} graden" terug naar de AI-agent
```

De AI wacht tot 10 seconden op een antwoord. Zonder "Stuur antwoord terug"-kaart krijgt de AI het bericht "flow triggered successfully".

Na het aanmaken van een flow met de ALS-triggerkaart: herstart MCP AI Bridge. De flow verschijnt automatisch als MCP-tool met de naam `flow_[flownaam]`.

---

## Beveiliging

### API-sleutel (optioneel)

Stel een API-sleutel in via de app-instellingen. Clients sturen deze mee via:
- `Authorization: Bearer <sleutel>`
- `X-API-Key: <sleutel>`

Zonder sleutel vertrouwt de server je lokale netwerk (standaard).

### IP-whitelist (optioneel)

Beperk toegang tot specifieke IP-adressen. Vul een kommagescheiden lijst in, of gebruik `*` voor alle IPs (standaard). Het `/health`-eindpunt is altijd toegankelijk, ongeacht de whitelist.

### Rate limiting (optioneel)

Stel een maximumaantal aanvragen per IP per 60 seconden in. Clients die de limiet overschrijden krijgen HTTP 429. Stel in op 0 om uit te schakelen.

Beide instellingen zijn direct van kracht, herstarten is niet nodig.

---

## OpenAPI Spec en REST-snelkoppelingen

Elke tool is ook beschikbaar als gewone REST-aanroep:

| Endpoint | Methode | Beschrijving |
|----------|---------|-------------|
| `/openapi.json` | GET | Volledige OpenAPI 3.1-spec |
| `/tools/{naam}` | POST | Tool direct aanroepen |
| `/health` | GET | Serverstatus |
| `/info` | GET | Serverinfo en toollijst |
| `/mcp` | POST/GET/DELETE | MCP JSON-RPC en SSE |

```bash
# Health check
curl http://[homey-ip]:52199/health
# {"status":"ok","version":"1.4.0","tools":80,"sessions":1}
```

---

## Personal Access Token (optioneel)

Alleen nodig voor het aanmaken, aanpassen of verwijderen van flows:

1. Ga naar my.homey.app > Instellingen > API
2. Maak een token aan met de `homey.flow` scope
3. Plak het token in de app-instellingen
4. Herstart de app

---

## Probleemoplossing

**AI-agent kan niet verbinden:**
- Controleer of het IP-adres klopt (zie instellingenpagina)
- Zorg dat poort 52199 niet geblokkeerd wordt door je firewall
- Test: open `http://[homey-ip]:52199/health` in je browser

**Flows aanmaken lukt niet:**
- Controleer of je een geldig Personal Access Token hebt ingesteld
- Controleer of de token de `homey.flow` scope heeft

**Verbinding geweigerd (403):**
- Controleer of je IP in de whitelist staat, of dat de API-sleutel correct is

**Te veel aanvragen (429):**
- Je hebt de rate limit bereikt. Wacht even of verhoog de limiet in de instellingen.

**Settings pagina laadt niet:**
- Herstart de app via de Homey-app

---

## Technische Details

- **Protocol:** MCP 2025-03-26 (StreamableHTTP + JSON-RPC 2.0)
- **Standaard poort:** 52199 (aanpasbaar in instellingen)
- **Authenticatie:** optionele API-sleutel (Bearer of X-API-Key)
- **Homey SDK:** v3
- **Platforms:** lokaal (Homey Pro)

---

## Licentie

MIT

---

*Gebouwd door de Homey community. Niet officieel gelieerd aan Athom of Anthropic.*
