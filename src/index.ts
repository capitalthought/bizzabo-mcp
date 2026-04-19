#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BizzaboClient } from './client.js';
import { registerEventTools } from './tools/events.js';
import { registerSessionTools } from './tools/sessions.js';
import { registerSpeakerTools } from './tools/speakers.js';
import { registerContactTools } from './tools/contacts.js';
import { registerPartnerTools } from './tools/partners.js';
import { registerAgendaTools } from './tools/agenda.js';
import { registerRegistrationTools } from './tools/registrations.js';

const clientId = process.env.BIZZABO_CLIENT_ID;
const clientSecret = process.env.BIZZABO_CLIENT_SECRET;
const accountId = process.env.BIZZABO_ACCOUNT_ID;

if (!clientId || !clientSecret || !accountId) {
  process.stderr.write('Error: BIZZABO_CLIENT_ID, BIZZABO_CLIENT_SECRET, and BIZZABO_ACCOUNT_ID environment variables are required.\n');
  process.exit(1);
}

const client = new BizzaboClient({
  clientId,
  clientSecret,
  accountId: Number(accountId),
});
const server = new McpServer({ name: 'bizzabo', version: '1.0.0' });

registerEventTools(server, client);
registerSessionTools(server, client);
registerSpeakerTools(server, client);
registerContactTools(server, client);
registerPartnerTools(server, client);
registerAgendaTools(server, client);
registerRegistrationTools(server, client);

// Graceful shutdown
process.on('SIGINT', async () => { await server.close(); process.exit(0); });
process.on('SIGTERM', async () => { await server.close(); process.exit(0); });
process.on('uncaughtException', (err) => { process.stderr.write(`[bizzabo-mcp] Uncaught exception: ${err.message}\n`); process.exit(1); });
process.on('unhandledRejection', (err) => { process.stderr.write(`[bizzabo-mcp] Unhandled rejection: ${err}\n`); process.exit(1); });

const transport = new StdioServerTransport();
await server.connect(transport);
