---
id: 20260509-200402-mcp-sessions-agenda-return-404
source_repo: supernova
target_repo: bizzabo-mcp
filed_at: 2026-05-09T20:04:02-05:00
filed_by: claude-opus-4-7
filed_from_machine: JoshHome
severity: high
status: open
repro_hash: 7c6372d1
tags: [mcp, sessions, agenda, regression, bizzabo-api]
related_commit: null
gh_issue: null
---

## Summary
`mcp__bizzabo__list_sessions` and `mcp__bizzabo__get_agenda` return `not_found` for **every** event tested — including events with confirmed populated sessions in the Bizzabo UI. Wider regression in the wrapper (or upstream Bizzabo API path), not specific to any one event.

## Reproducer
```
mcp__bizzabo__list_sessions({eventId: "743915"})
mcp__bizzabo__list_sessions({eventId: "571072"})
mcp__bizzabo__get_agenda({eventId: "743915"})
```

## Expected
- For `743915` (Health Supernova, May 13-14 2026, status=`published`): if sessions are populated upstream, return them; otherwise return an empty list with `200 OK`, not a 404.
- For `571072` (Fed Supernova 2024, status=`unpublished` / archived): return the populated session list. This event ran in production with a full agenda — sessions exist in Bizzabo, just on an archived event.
- `mcp__bizzabo__get_event` works fine for both event IDs (returns the event metadata with venue, dates, etc.) — so the auth + path-prefix wiring is healthy. The regression is scoped to `/sessions` + `/agenda`.

## Actual
All three calls fail with the same shape:

```
{"error":"unexpected_error","message":"API error on /events/743915/sessions: not_found — Not Found"}
{"error":"unexpected_error","message":"API error on /events/571072/sessions: not_found — Not Found"}
{"error":"not_found","message":"Not Found"}
```

The first two preserve the upstream HTTP status text in `message`; the third (`get_agenda`) collapses it to a generic `not_found`. Both endpoints fail; `get_event` against the same event IDs succeeds.

## Environment
- macOS (JoshHome — Mac Studio, Apple Silicon)
- Bizzabo MCP wrapper version: whatever's in `~/.claude.json mcpServers.bizzabo` at HEAD on JoshHome (last update unknown — please correlate against `package.json` version + git log when triaging)
- Model: claude-opus-4-7 (Claude Code CLI session)
- Discovered while running `/todo all` in supernova for the HSN sessions import retry — original assumption was "wait for event team to add sessions in Bizzabo," but probing FSN 2024 (known-populated past event) returned the same 404. Diagnosis took ~30 seconds; previous sessions of supernova work assumed the not_found was transient HSN-side.

## Notes
- **Likely root causes** (lowest-effort first; pick whichever the maintainer can confirm fastest):
  1. **API path drift.** The wrapper's calling `GET /v1/events/{id}/sessions`. Bizzabo may have moved this in a recent API rev (v2-only? `/v2/events/{id}/agenda/sessions`?). Check current Bizzabo developer docs for the canonical sessions/agenda endpoint and update the wrapper.
  2. **Auth scope.** The `events.read` scope on the API token may have been split from `sessions.read` in a recent permissions overhaul. `get_event` succeeds but `get_sessions` fails — consistent with a scope-coverage gap.
  3. **Wrapper bug.** Some other recent change in the bizzabo-mcp wrapper code (cf. dist vs src drift, build artifact stale).
- **Cross-repo impact:** supernova can't auto-import HSN sessions for the May 13-14 event (4 days out) until this is resolved. Manual entry from `https://www.healthsupernova.com` is the only workaround. Likely also blocks any future event mirror that needs an agenda copy.
- **Wider impact:** Probably also blocks bizzabo-mcp's primary use case — exposing event agendas to agents. Worth checking if the speakers / partners / registrations endpoints are similarly affected, or if it's only the agenda surface.
- **Confirmation that auth is healthy:** `mcp__bizzabo__list_events` returns 100+ events; `mcp__bizzabo__list_speakers({eventId: "743915"})` returned 41 speakers earlier in this session (used for the HSN photo migration). So API token + base URL are fine — it's specifically the sessions/agenda endpoints.

## Symptoms first observed
- Session ID: 173b26a4-8a54-4766-82ed-2b702eb5572a (supernova session on JoshHome, today)
- Filed by: claude-opus-4-7 in `~/Xcode/supernova` after the `/todo all` run for HSN sessions retry surfaced the regression. Diagnosed by probing FSN 2024 to rule out "sessions not populated upstream."
