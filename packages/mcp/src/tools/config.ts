import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getConfigValue, setConfigValue, deleteConfigValue, listConfig,
} from '@agent-memory/core';
import { z } from 'zod';
import { success, error } from '../utils.js';

export function registerConfigTools(server: McpServer): void {
  server.registerTool(
    'config_set',
    {
      title: 'Set Config',
      description: [
        'Set a configuration value.',
        '',
        'Args:',
        '  key: Configuration key (e.g. "embedding.model").',
        '  value: Configuration value to set.',
        '  source: Source name (defaults to global config).',
        '',
        'Returns: { key, value }',
      ].join('\n'),
      inputSchema: {
        key: z.string().min(1).describe('Configuration key'),
        value: z.string().min(1).describe('Configuration value'),
        source: z.string().optional().describe('Source name (defaults to global)'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ key, value, source }) => {
      try {
        setConfigValue(key, value, source);
        return success({ key, value });
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'config_get',
    {
      title: 'Get Config',
      description: [
        'Get a configuration value by key.',
        '',
        'Args:',
        '  key: Configuration key to look up.',
        '  source: Source name (defaults to global config).',
        '',
        'Returns: { key, value }',
      ].join('\n'),
      inputSchema: {
        key: z.string().min(1).describe('Configuration key'),
        source: z.string().optional().describe('Source name (defaults to global)'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ key, source }) => {
      try {
        const value = getConfigValue(key, source);
        if (value === undefined) {
          return error(
            new Error(`Config key not found: ${key}`),
            'Use config_list to see all available keys',
          );
        }
        return success({ key, value });
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'config_list',
    {
      title: 'List Config',
      description: [
        'List all configuration key-value pairs.',
        '',
        'Args:',
        '  source: Source name (defaults to global config).',
        '',
        'Returns: { entries: { key1: value1, key2: value2, ... } }',
      ].join('\n'),
      inputSchema: {
        source: z.string().optional().describe('Source name (defaults to global)'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ source }) => {
      try {
        const values = listConfig(source);
        return success({ entries: values });
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'config_delete',
    {
      title: 'Delete Config',
      description: [
        'Delete a configuration value by key.',
        '',
        'Args:',
        '  key: Configuration key to delete.',
        '  source: Source name (defaults to global config).',
        '',
        'Returns: { deleted: "key" }',
      ].join('\n'),
      inputSchema: {
        key: z.string().min(1).describe('Configuration key to delete'),
        source: z.string().optional().describe('Source name (defaults to global)'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
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
