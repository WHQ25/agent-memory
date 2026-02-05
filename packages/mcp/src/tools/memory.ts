import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SqliteSource } from '@agent-memory/core';
import { z } from 'zod';
import { injectMetadata } from '../source.js';

function success(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function error(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true as const };
}

export function registerMemoryTools(
  server: McpServer,
  getSource: () => Promise<SqliteSource>,
): void {
  server.registerTool(
    'memory_add',
    {
      description: 'Store a new memory. Returns summary without content.',
      inputSchema: {
        content: z.string().describe('The memory content to store'),
        tags: z.string().optional().describe('Comma-separated tags'),
        digest: z.string().optional().describe('Short summary for search results'),
      },
    },
    async ({ content, tags, digest }) => {
      try {
        const source = await getSource();
        const tagList = tags ? tags.split(',').map(t => t.trim()) : undefined;
        const metadata = injectMetadata('local');
        const memory = await source.add({ content, digest, tags: tagList, metadata });
        const { content: _, ...summary } = memory;
        return success(summary);
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'memory_get',
    {
      description: 'Retrieve memories by ID. Returns content by default, or full metadata with full=true.',
      inputSchema: {
        ids: z.string().describe('Comma-separated memory IDs'),
        full: z.boolean().optional().default(false).describe('Include all metadata'),
      },
    },
    async ({ ids, full }) => {
      try {
        const source = await getSource();
        const idList = ids.split(',').map(s => s.trim());
        const memories = await source.get(idList);
        if (memories.length === 0) {
          return error(new Error('No memories found'));
        }
        if (full) {
          return success(memories);
        }
        const contents = memories.map(m => ({ id: m.id, content: m.content }));
        return success(contents);
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'memory_update',
    {
      description: 'Update a memory by ID. Returns summary without content.',
      inputSchema: {
        id: z.string().describe('Memory ID to update'),
        content: z.string().optional().describe('New content'),
        tags: z.string().optional().describe('New comma-separated tags'),
        digest: z.string().optional().describe('New digest'),
      },
    },
    async ({ id, content, tags, digest }) => {
      try {
        const source = await getSource();
        const tagList = tags ? tags.split(',').map(t => t.trim()) : undefined;
        const metadata = injectMetadata('local');
        const memory = await source.update(id, { content, digest, tags: tagList, metadata });
        const { content: _, ...summary } = memory;
        return success(summary);
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'memory_delete',
    {
      description: 'Delete memories by ID.',
      inputSchema: {
        ids: z.string().describe('Comma-separated memory IDs to delete'),
      },
    },
    async ({ ids }) => {
      try {
        const source = await getSource();
        const idList = ids.split(',').map(s => s.trim());
        await source.delete(idList);
        return success({ deleted: idList });
      } catch (e) {
        return error(e);
      }
    },
  );
}
