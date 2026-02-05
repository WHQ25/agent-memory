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

export function registerSearchTools(
  server: McpServer,
  getSource: () => Promise<SqliteSource>,
): void {
  server.registerTool(
    'memory_search',
    {
      description: 'Search memories by query. Returns matching results with scores.',
      inputSchema: {
        query: z.string().describe('Search query'),
        tags: z.string().optional().describe('Comma-separated tags to filter by'),
        limit: z.number().optional().default(10).describe('Max results'),
        after: z.string().optional().describe('Filter by creation date (after, ISO 8601)'),
        before: z.string().optional().describe('Filter by creation date (before, ISO 8601)'),
      },
    },
    async ({ query, tags, limit, after, before }) => {
      try {
        const source = await getSource();
        const tagList = tags ? tags.split(',').map(t => t.trim()) : undefined;
        const metadata = injectMetadata('local');
        const results = await source.search(query, {
          tags: tagList,
          limit,
          after,
          before,
          metadata,
        });
        return success(results);
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'memory_list',
    {
      description: 'Browse and filter memories. Returns summaries (no content).',
      inputSchema: {
        tags: z.string().optional().describe('Comma-separated tags to filter by'),
        limit: z.number().optional().default(10).describe('Max results'),
        offset: z.number().optional().default(0).describe('Skip first n results'),
        sort: z.enum(['time', 'access']).optional().default('time').describe('Sort order'),
        after: z.string().optional().describe('Filter by creation date (after, ISO 8601)'),
        before: z.string().optional().describe('Filter by creation date (before, ISO 8601)'),
      },
    },
    async ({ tags, limit, offset, sort, after, before }) => {
      try {
        const source = await getSource();
        const tagList = tags ? tags.split(',').map(t => t.trim()) : undefined;
        const metadata = injectMetadata('local');
        const memories = await source.list({
          tags: tagList,
          limit,
          offset,
          sort,
          after,
          before,
          metadata,
        });
        const summaries = memories.map(m => ({
          id: m.id,
          digest: m.digest,
          tags: m.tags,
          createdAt: m.createdAt,
          accessCount: m.accessCount,
        }));
        return success(summaries);
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'memory_tags',
    {
      description: 'List all tags with usage counts.',
    },
    async () => {
      try {
        const source = await getSource();
        const tagList = await source.tags();
        return success(tagList);
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'memory_stats',
    {
      description: 'Show memory store statistics.',
    },
    async () => {
      try {
        const source = await getSource();
        const stats = await source.stats();
        return success(stats);
      } catch (e) {
        return error(e);
      }
    },
  );
}
