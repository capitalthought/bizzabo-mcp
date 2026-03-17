import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BizzaboClient, isApiError } from '../client.js';

export function registerPartnerTools(server: McpServer, client: BizzaboClient): void {
  server.registerTool(
    'list_partners',
    {
      title: 'List Partners',
      description: 'List sponsors and exhibitor partners for an event. Returns company name, tier, and booth info.',
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
          const result = await client.get(`/events/${eventId}/partners`, params);
          if (isApiError(result)) {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], isError: true };
          }
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                partners: result.content,
                count: result.content.length,
                truncated: false,
                totalAvailable: result.page.totalElements,
              }),
            }],
          };
        } else {
          const params: Record<string, string> = {};
          if (size !== undefined) params.size = String(size);
          const result = await client.getAll(`/events/${eventId}/partners`, params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                partners: result.items,
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
    'get_partner',
    {
      title: 'Get Partner',
      description: 'Get full partner/sponsor details including logo, description, and tier.',
      inputSchema: z.object({
        eventId: z.string().regex(/^\d+$/).describe('The Bizzabo event ID (numeric).'),
        partnerId: z.string().describe('The partner ID.'),
      }),
    },
    async ({ eventId, partnerId }) => {
      try {
        const result = await client.getSingle(`/events/${eventId}/partners/${partnerId}`);
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
