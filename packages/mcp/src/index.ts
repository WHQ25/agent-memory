#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { closeSource } from './source.js';

const server = createServer();
const transport = new StdioServerTransport();

process.on('SIGINT', async () => {
  await closeSource();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeSource();
  process.exit(0);
});

await server.connect(transport);
