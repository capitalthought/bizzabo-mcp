import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BizzaboClient, isApiError } from '../client.js';

export function registerContactTools(server: McpServer, client: BizzaboClient): void {
  server.registerTool(
    'list_contacts',
    {
      title: 'List Contacts',
      description: 'List all contacts (attendees, speakers, staff, exhibitors) for an event. Returns name, email, role, registration status. Use list_registrations instead for ticket/payment details.',
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
          const result = await client.get(`/events/${eventId}/contacts`, params);
          if (isApiError(result)) {
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], isError: true };
          }
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                contacts: result.content,
                count: result.content.length,
                truncated: false,
                totalAvailable: result.page.totalElements,
              }),
            }],
          };
        } else {
          const params: Record<string, string> = {};
          if (size !== undefined) params.size = String(size);
          const result = await client.getAll(`/events/${eventId}/contacts`, params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                contacts: result.items,
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
    'get_contact',
    {
      title: 'Get Contact',
      description: 'Get full contact profile for an event attendee.',
      inputSchema: z.object({
        eventId: z.string().regex(/^\d+$/).describe('The Bizzabo event ID (numeric).'),
        contactId: z.string().describe('The contact ID.'),
      }),
    },
    async ({ eventId, contactId }) => {
      try {
        const result = await client.getSingle(`/events/${eventId}/contacts/${contactId}`);
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
