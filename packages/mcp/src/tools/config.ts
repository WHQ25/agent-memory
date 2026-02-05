import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getConfigValue, setConfigValue, deleteConfigValue, listConfig,
} from '@agent-memory/core';
import { z } from 'zod';

function success(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function error(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true as const };
}

export function registerConfigTools(server: McpServer): void {
  server.registerTool(
    'config_set',
    {
      description: 'Set a configuration value.',
      inputSchema: {
        key: z.string().describe('Configuration key'),
        value: z.string().describe('Configuration value'),
        source: z.string().optional().describe('Source name (defaults to global)'),
      },
    },
    async ({ key, value, source }) => {
      try {
        setConfigValue(key, value, source);
        return success({ [key]: value });
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'config_get',
    {
      description: 'Get a configuration value.',
      inputSchema: {
        key: z.string().describe('Configuration key'),
        source: z.string().optional().describe('Source name (defaults to global)'),
      },
    },
    async ({ key, source }) => {
      try {
        const value = getConfigValue(key, source);
        if (value === undefined) {
          return error(new Error(`Config key not found: ${key}`));
        }
        return success({ [key]: value });
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'config_list',
    {
      description: 'List all configuration values.',
      inputSchema: {
        source: z.string().optional().describe('Source name (defaults to global)'),
      },
    },
    async ({ source }) => {
      try {
        const values = listConfig(source);
        return success(values);
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'config_delete',
    {
      description: 'Delete a configuration value.',
      inputSchema: {
        key: z.string().describe('Configuration key'),
        source: z.string().optional().describe('Source name (defaults to global)'),
      },
    },
    async ({ key, source }) => {
      try {
        deleteConfigValue(key, source);
        return success({ deleted: key });
      } catch (e) {
        return error(e);
      }
    },
  );
}
