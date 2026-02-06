import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SqliteSource } from '@agent-memory/core';
import { z } from 'zod';
import { success, error } from '../utils.js';

export function registerSourceTools(
  server: McpServer,
  getSource: () => Promise<SqliteSource>,
): void {
  server.registerTool(
    'source_list',
    {
      title: 'List Sources',
      description: 'List configured memory sources. Currently only supports a single local SQLite source.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const sources = [
          { name: 'local', type: 'sqlite', active: true },
        ];
        return success({ sources });
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'source_run',
    {
      title: 'Run Source Command',
      description: [
        'Run a source management command (e.g. embed, embed-rebuild). Omit command to list available commands.',
        '',
        'Args:',
        '  command: Command name to run. Omit to list all available commands.',
        '',
        'Returns: { commands: [...] } when listing, or { result: ... } when running.',
      ].join('\n'),
      inputSchema: {
        command: z.string().min(1).optional().describe('Command to run. Omit to list available commands.'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ command }) => {
      try {
        const source = await getSource();
        const available = source.commands();

        if (!command) {
          return success({ commands: available });
        }

        const valid = available.map((c) => c.name);
        if (!valid.includes(command)) {
          return error(
            new Error(`Unknown command: ${command}`),
            `Available commands: ${valid.join(', ')}. Omit command to list all`,
          );
        }

        const result = await source.run(command, { onProgress: () => {} });
        return success({ result: result as Record<string, unknown> });
      } catch (e) {
        return error(e);
      }
    },
  );
}
