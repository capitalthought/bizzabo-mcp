import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BizzaboClient, isApiError } from '../client.js';

export function registerEventTools(server: McpServer, client: BizzaboClient): void {
  server.registerTool(
    'list_events',
    {
      title: 'List Events',
      description: 'List all events in your Bizzabo account. Returns event name, dates, status, and ID.',
      inputSchema: z.object({
        page: z.number().int().nonnegative().optional().describe('Page number (0-based). If omitted, all pages are fetched automatically.'),
        size: z.number().int().positive().optional().describe('Number of results per page (default 100).'),
      }),
    },
    async ({ page, size }) => {
      try {
        if (page !== undefined) {
          const params: Record<string, string> = { page: String(page) };
          if (size !== undefined) params.size = String(size);
          const result = await client.get('/events', params);
          if (isApiError(result)) {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], isError: true };
          }
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                events: result.content,
                count: result.content.length,
                truncated: false,
                totalAvailable: result.page.totalElements,
              }),
            }],
          };
        } else {
          const params: Record<string, string> = {};
          if (size !== undefined) params.size = String(size);
          const result = await client.getAll('/events', params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                events: result.items,
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
    'get_event',
    {
      title: 'Get Event',
      description: 'Get full details for a single event by ID, including venue, dates, and settings.',
      inputSchema: z.object({
        eventId: z.string().regex(/^\d+$/).describe('The Bizzabo event ID (numeric).'),
      }),
    },
    async ({ eventId }) => {
      try {
        const result = await client.getSingle(`/events/${eventId}`);
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
