import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SqliteSource } from '@agent-memory/core';
import { z } from 'zod';
import { injectMetadata } from '../source.js';
import { success, error, parseTags, parseIds } from '../utils.js';

export function registerMemoryTools(
  server: McpServer,
  getSource: () => Promise<SqliteSource>,
): void {
  server.registerTool(
    'memory_add',
    {
      title: 'Add Memory',
      description: [
        'Store a new memory with optional tags and digest. Deduplicates by content hash.',
        '',
        'Args:',
        '  content: The memory content to store.',
        '  tags: Comma-separated tags for categorization (e.g. "bug,node,esm").',
        '  digest: Short summary for search results. Defaults to content if omitted.',
        '',
        'Returns: Memory summary (id, hash, digest, tags, timestamps) without content.',
      ].join('\n'),
      inputSchema: {
        content: z.string().min(1).describe('The memory content to store'),
        tags: z.string().optional().describe('Comma-separated tags (e.g. "bug,node,esm")'),
        digest: z.string().max(500).optional().describe('Short summary for search results'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ content, tags, digest }) => {
      try {
        const source = await getSource();
        const tagList = tags ? parseTags(tags) : undefined;
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
      title: 'Get Memories',
      description: [
        'Retrieve one or more memories by ID. Returns content by default, or full metadata with full=true.',
        '',
        'Args:',
        '  ids: Comma-separated memory IDs to retrieve.',
        '  full: When true, includes all metadata (hash, tags, timestamps, accessCount).',
        '',
        'Returns: { memories: [{ id, content, ... }] }',
      ].join('\n'),
      inputSchema: {
        ids: z.string().min(1).describe('Comma-separated memory IDs'),
        full: z.boolean().optional().default(false).describe('Include all metadata'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ ids, full }) => {
      try {
        const source = await getSource();
        const idList = parseIds(ids);
        const memories = await source.get(idList);
        if (memories.length === 0) {
          return error(
            new Error('No memories found'),
            'Use memory_list to browse available memories or memory_search to find by content',
          );
        }
        if (full) {
          return success({ memories });
        }
        const contents = memories.map(m => ({ id: m.id, content: m.content }));
        return success({ memories: contents });
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'memory_update',
    {
      title: 'Update Memory',
      description: [
        'Update a memory by ID. Only provided fields are changed.',
        '',
        'Args:',
        '  id: Memory ID to update.',
        '  content: New content (replaces existing).',
        '  tags: New comma-separated tags (replaces existing).',
        '  digest: New digest summary.',
        '',
        'Returns: Memory summary (without content).',
      ].join('\n'),
      inputSchema: {
        id: z.string().min(1).describe('Memory ID to update'),
        content: z.string().min(1).optional().describe('New content'),
        tags: z.string().optional().describe('New comma-separated tags'),
        digest: z.string().max(500).optional().describe('New digest'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, content, tags, digest }) => {
      try {
        const source = await getSource();
        const tagList = tags ? parseTags(tags) : undefined;
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
      title: 'Delete Memories',
      description: [
        'Permanently delete one or more memories by ID.',
        '',
        'Args:',
        '  ids: Comma-separated memory IDs to delete.',
        '',
        'Returns: { deleted: ["id1", "id2"] }',
      ].join('\n'),
      inputSchema: {
        ids: z.string().min(1).describe('Comma-separated memory IDs to delete'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ ids }) => {
      try {
        const source = await getSource();
        const idList = parseIds(ids);
        await source.delete(idList);
        return success({ deleted: idList });
      } catch (e) {
        return error(e);
      }
    },
  );
}
