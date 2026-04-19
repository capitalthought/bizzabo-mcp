# bizzabo-mcp

[![npm version](https://img.shields.io/npm/v/@capitalthought/bizzabo-mcp.svg)](https://www.npmjs.com/package/@capitalthought/bizzabo-mcp)

MCP server for the [Bizzabo](https://www.bizzabo.com/) event management API. Exposes 12 tools for reading events, sessions, speakers, contacts, partners, agenda items, and registrations — wrapped in OAuth2 auth, auto-pagination, 60s caching, and 429 retry-with-backoff.

## Quick start

You need three Bizzabo OAuth2 credentials: `BIZZABO_CLIENT_ID`, `BIZZABO_CLIENT_SECRET`, `BIZZABO_ACCOUNT_ID`. Get them from your Bizzabo admin → **Integrations → API → OAuth2 Client Credentials**. Then pick the client you're using below.

## Use with Claude (Desktop or Code)

Drop this into `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows), or `~/.config/claude/mcp.json` for Claude Code:

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

Restart Claude. Ask "list my Bizzabo events" — it should call `list_events`.

## Use with ChatGPT

MCP works with ChatGPT two different ways depending on what you have:

### Option A — ChatGPT Desktop (Developer Mode, Plus/Pro/Team/Enterprise)

OpenAI's Desktop app added local MCP support via Developer Mode.

1. In ChatGPT Desktop → **Settings → Connectors → Advanced** → enable **Developer Mode**.
2. **Settings → Connectors → Create** → choose **Local MCP server**.
3. Fill in:
   - **Name:** `Bizzabo`
   - **Command:** `npx`
   - **Arguments:** `-y @capitalthought/bizzabo-mcp`
   - **Environment variables:** add `BIZZABO_CLIENT_ID`, `BIZZABO_CLIENT_SECRET`, `BIZZABO_ACCOUNT_ID`
4. Save, then toggle the connector **on** in the new-chat composer.
5. Ask "list my upcoming Bizzabo events" — you'll see tool-call cards for `list_events` etc.

> Note: Local MCP connectors only work in the Desktop app (not chatgpt.com in a browser). The set of plans that can enable Developer Mode has shifted over time — if you don't see the setting, check OpenAI's connector docs for your plan.

### Option B — OpenAI Agents SDK (for developers)

If you're building on top of OpenAI's API, the [Agents SDK](https://openai.github.io/openai-agents-python/mcp/) can launch the MCP server directly.

**Python:**

```python
from agents import Agent, Runner
from agents.mcp import MCPServerStdio

async def main():
    async with MCPServerStdio(
        name="bizzabo",
        params={
            "command": "npx",
            "args": ["-y", "@capitalthought/bizzabo-mcp"],
            "env": {
                "BIZZABO_CLIENT_ID": "...",
                "BIZZABO_CLIENT_SECRET": "...",
                "BIZZABO_ACCOUNT_ID": "...",
            },
        },
    ) as bizzabo:
        agent = Agent(
            name="Event Assistant",
            instructions="Use Bizzabo to answer questions about events.",
            mcp_servers=[bizzabo],
        )
        result = await Runner.run(agent, "List the next 5 events.")
        print(result.final_output)
```

**TypeScript (`@openai/agents`):**

```ts
import { Agent, run, MCPServerStdio } from "@openai/agents";

const bizzabo = new MCPServerStdio({
  name: "bizzabo",
  command: "npx",
  args: ["-y", "@capitalthought/bizzabo-mcp"],
  env: {
    BIZZABO_CLIENT_ID: "...",
    BIZZABO_CLIENT_SECRET: "...",
    BIZZABO_ACCOUNT_ID: "...",
  },
});

await bizzabo.connect();
const agent = new Agent({
  name: "Event Assistant",
  instructions: "Use Bizzabo to answer questions about events.",
  mcpServers: [bizzabo],
});
console.log((await run(agent, "List the next 5 events.")).finalOutput);
await bizzabo.close();
```

## Use with Gemini

### Option A — Gemini CLI (recommended)

Install the CLI if you haven't: `npm install -g @google/gemini-cli`.

Add to `~/.gemini/settings.json`:

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

Then run `gemini` and ask "what Bizzabo events are coming up?".

### Option B — Gemini API via Python SDK (for developers)

The `google-genai` SDK auto-translates MCP tool listings into Gemini function-calls:

```python
import asyncio
from google import genai
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

client = genai.Client()

async def main():
    params = StdioServerParameters(
        command="npx",
        args=["-y", "@capitalthought/bizzabo-mcp"],
        env={
            "BIZZABO_CLIENT_ID": "...",
            "BIZZABO_CLIENT_SECRET": "...",
            "BIZZABO_ACCOUNT_ID": "...",
        },
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            response = await client.aio.models.generate_content(
                model="gemini-2.0-flash",
                contents="List the next 5 Bizzabo events.",
                config=genai.types.GenerateContentConfig(
                    tools=[session],
                ),
            )
            print(response.text)

asyncio.run(main())
```

The same pattern works with Google's **Agent Development Kit (ADK)** — register the stdio server as a toolset in your `Agent` config.

## Use with other MCP clients

Any MCP client that speaks stdio works with the same three pieces:

- **Command:** `npx`
- **Args:** `["-y", "@capitalthought/bizzabo-mcp"]`
- **Env:** `BIZZABO_CLIENT_ID`, `BIZZABO_CLIENT_SECRET`, `BIZZABO_ACCOUNT_ID`

Known-working clients at the time of writing: Claude Desktop, Claude Code, Cursor, Windsurf, Zed, Cline, Continue, OpenAI Agents SDK, Gemini CLI, Google ADK.

## Install globally (optional)

If you prefer an installed binary over `npx`:

```bash
npm install -g @capitalthought/bizzabo-mcp
# then use "command": "bizzabo-mcp" in any MCP config above
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BIZZABO_CLIENT_ID` | ✅ | OAuth2 client ID |
| `BIZZABO_CLIENT_SECRET` | ✅ | OAuth2 client secret |
| `BIZZABO_ACCOUNT_ID` | ✅ | Numeric account ID |
| `DEBUG` | — | Set to `1` to log OAuth + request details to stderr |

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
