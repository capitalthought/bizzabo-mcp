import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BizzaboClient, isApiError } from '../client.js';

export function registerAgendaTools(server: McpServer, client: BizzaboClient): void {
  server.registerTool(
    'get_agenda',
    {
      title: 'Get Agenda',
      description: 'Get the full event agenda with sessions organized by day and track.',
      inputSchema: z.object({
        eventId: z.string().regex(/^\d+$/).describe('The Bizzabo event ID (numeric).'),
      }),
    },
    async ({ eventId }) => {
      try {
        const result = await client.getSingle(`/events/${eventId}/agenda`);
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
