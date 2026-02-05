import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SqliteSource } from '@agent-memory/core';
import { z } from 'zod';

function success(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function error(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true as const };
}

export function registerSourceTools(
  server: McpServer,
  getSource: () => Promise<SqliteSource>,
): void {
  server.registerTool(
    'source_list',
    {
      description: 'List configured memory sources.',
    },
    async () => {
      try {
        const sources = [
          { name: 'local', type: 'sqlite', active: true },
        ];
        return success(sources);
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'source_run',
    {
      description: 'Run a source management command (e.g. vacuum, reindex). Omit command to list available commands.',
      inputSchema: {
        command: z.string().optional().describe('Command to run. Omit to list available commands.'),
      },
    },
    async ({ command }) => {
      try {
        const source = await getSource();
        const available = source.commands();

        if (!command) {
          return success(available);
        }

        const valid = available.map((c) => c.name);
        if (!valid.includes(command)) {
          return error(new Error(`Unknown command: ${command}. Available: ${valid.join(', ')}`));
        }

        const result = await source.run(command, { onProgress: () => {} });
        return success(result);
      } catch (e) {
        return error(e);
      }
    },
  );
}
