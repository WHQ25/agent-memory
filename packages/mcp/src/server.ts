import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SqliteSource } from '@agent-memory/core';
import { resolveSource } from './source.js';
import { registerMemoryTools } from './tools/memory.js';
import { registerSearchTools } from './tools/search.js';
import { registerSourceTools } from './tools/source.js';
import { registerConfigTools } from './tools/config.js';

export function createServer(injectedSource?: SqliteSource): McpServer {
  const server = new McpServer({
    name: 'agent-memory',
    version: '0.1.2',
  });

  const getSource = async () => injectedSource ?? await resolveSource();

  registerMemoryTools(server, getSource);
  registerSearchTools(server, getSource);
  registerSourceTools(server, getSource);
  registerConfigTools(server);

  return server;
}
