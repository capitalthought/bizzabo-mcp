# bizzabo-mcp

[![npm version](https://img.shields.io/npm/v/@capitalthought/bizzabo-mcp.svg)](https://www.npmjs.com/package/@capitalthought/bizzabo-mcp)

MCP server for the [Bizzabo](https://www.bizzabo.com/) event management API. Exposes 12 tools for reading events, sessions, speakers, contacts, partners, agenda items, and registrations — wrapped in OAuth2 auth, auto-pagination, 60s caching, and 429 retry-with-backoff.

## Install

Use directly via `npx` (no install needed):

```json
{
  "mcpServers": {
    "bizzabo": {
      "command": "npx",
      "args": ["-y", "@capitalthought/bizzabo-mcp"],
      "env": {
        "BIZZABO_CLIENT_ID": "...",
        "BIZZABO_CLIENT_SECRET": "...",
        "BIZZABO_ACCOUNT_ID": "..."
      }
    }
  }
}
```

Or install globally:

```bash
npm install -g @capitalthought/bizzabo-mcp
```

## Configure

Three env vars, all required. Get them from your Bizzabo admin — **Integrations → API → OAuth2 Client Credentials**.

| Variable | Description |
|----------|-------------|
| `BIZZABO_CLIENT_ID` | OAuth2 client ID |
| `BIZZABO_CLIENT_SECRET` | OAuth2 client secret |
| `BIZZABO_ACCOUNT_ID` | Numeric account ID |
| `DEBUG` | Optional. Set to `1` to log OAuth + request details to stderr |

## Tools

| Tool | Description |
|------|-------------|
| `list_events` | List all events in the account |
| `get_event` | Get a single event by ID |
| `list_sessions` | List sessions for an event |
| `get_session` | Get a single session by ID |
| `list_speakers` | List speakers for an event |
| `get_speaker` | Get a single speaker by ID |
| `list_contacts` | List contacts in the account |
| `get_contact` | Get a single contact by ID |
| `list_partners` | List partners/sponsors for an event |
| `get_partner` | Get a single partner by ID |
| `get_agenda` | Get an event's agenda |
| `list_registrations` | List registrations for an event |

List endpoints auto-paginate when called without a `page` argument (up to 10 pages × 100 items = 1,000 records).

## Architecture

- **OAuth2 client credentials** flow against `auth.bizzabo.com`. Tokens are cached in-memory and refreshed 5 minutes before expiry.
- **60-second response cache** (per URL + sorted query params) to avoid hammering the API on repeated identical calls.
- **Auto-pagination** via `getAll()` — follows `totalPages`, inserts 100ms inter-page delay, stops at `maxPages` and reports `truncated: true`.
- **429 retry** with exponential backoff (1s → 2s, max 2 retries per page).
- **Structured errors** — auth/rate/server/not-found errors return `{ error, message }` rather than throwing.

## Development

```bash
npm install
npm run build       # tsc → dist/
npm run dev         # tsc --watch
npm start           # run the server against real Bizzabo
```

## Status

Tests in `tests/` are currently stale (written against a pre-OAuth2 API-key design; 12 failing). Fixing them is tracked as a TODO.

## License

MIT
