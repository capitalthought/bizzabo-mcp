import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BizzaboClient, isApiError } from '../client.js';

export function registerSessionTools(server: McpServer, client: BizzaboClient): void {
  server.registerTool(
    'list_sessions',
    {
      title: 'List Sessions',
      description: 'List all sessions (talks, workshops, panels) for an event. Returns title, time, track, and speaker IDs.',
      inputSchema: z.object({
        eventId: z.string().regex(/^\d+$/).describe('The Bizzabo event ID (numeric).'),
        page: z.number().int().nonnegative().optional().describe('Page number (0-based). If omitted, all pages are fetched automatically.'),
        size: z.number().int().positive().optional().describe('Number of results per page (default 100).'),
      }),
    },
    async ({ eventId, page, size }) => {
      try {
        if (page !== undefined) {
          const params: Record<string, string> = { page: String(page) };
          if (size !== undefined) params.size = String(size);
          const result = await client.get(`/events/${eventId}/sessions`, params);
          if (isApiError(result)) {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], isError: true };
          }
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                sessions: result.content,
                count: result.content.length,
                truncated: false,
                totalAvailable: result.page.totalElements,
              }),
            }],
          };
        } else {
          const params: Record<string, string> = {};
          if (size !== undefined) params.size = String(size);
          const result = await client.getAll(`/events/${eventId}/sessions`, params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                sessions: result.items,
                count: result.items.length,
                truncated: result.truncated,
                totalAvailable: result.totalElements,
              }),
            }],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'unexpected_error', message }) }], isError: true };
      }
    },
  );

  server.registerTool(
    'get_session',
    {
      title: 'Get Session',
      description: 'Get full details for a single session including description and speaker info.',
      inputSchema: z.object({
        eventId: z.string().regex(/^\d+$/).describe('The Bizzabo event ID (numeric).'),
        sessionId: z.string().describe('The session ID.'),
      }),
    },
    async ({ eventId, sessionId }) => {
      try {
        const result = await client.getSingle(`/events/${eventId}/sessions/${sessionId}`);
        if (isApiError(result)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], isError: true };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'unexpected_error', message }) }], isError: true };
      }
    },
  );
}
