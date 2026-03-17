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

const apiKey = process.env.BIZZABO_API_KEY;
if (!apiKey) {
  process.stderr.write('Error: BIZZABO_API_KEY environment variable is required.\n');
  process.exit(1);
}

const client = new BizzaboClient(apiKey);
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
