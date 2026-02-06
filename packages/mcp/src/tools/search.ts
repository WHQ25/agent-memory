import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SqliteSource } from '@agent-memory/core';
import { z } from 'zod';
import { injectMetadata } from '../source.js';
import { success, error, parseTags } from '../utils.js';

export function registerSearchTools(
  server: McpServer,
  getSource: () => Promise<SqliteSource>,
): void {
  server.registerTool(
    'memory_search',
    {
      title: 'Search Memories',
      description: [
        'Search memories by query using hybrid search (full-text + vector + RRF fusion).',
        '',
        'Args:',
        '  query: Search query string.',
        '  tags: Comma-separated tags to filter by (all must match).',
        '  limit: Maximum number of results (default 10, max 100).',
        '  after/before: ISO 8601 date filters for creation date.',
        '',
        'Returns: { results: [{ id, digest, tags, score, createdAt }] }',
      ].join('\n'),
      inputSchema: {
        query: z.string().min(1).describe('Search query'),
        tags: z.string().optional().describe('Comma-separated tags to filter by'),
        limit: z.number().int().min(1).max(100).optional().default(10).describe('Max results (default 10)'),
        after: z.string().optional().describe('Filter: created after this date (ISO 8601)'),
        before: z.string().optional().describe('Filter: created before this date (ISO 8601)'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, tags, limit, after, before }) => {
      try {
        const source = await getSource();
        const tagList = tags ? parseTags(tags) : undefined;
        const metadata = injectMetadata('local');
        const results = await source.search(query, {
          tags: tagList,
          limit,
          after,
          before,
          metadata,
        });
        return success({ results });
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'memory_list',
    {
      title: 'List Memories',
      description: [
        'Browse and filter memories with pagination. Returns summaries without content.',
        '',
        'Args:',
        '  tags: Comma-separated tags to filter by (all must match).',
        '  limit: Max results per page (default 10, max 100).',
        '  offset: Number of results to skip for pagination.',
        '  sort: Sort by "time" (newest first) or "access" (most accessed first).',
        '  after/before: ISO 8601 date filters for creation date.',
        '',
        'Returns: { items: [...], offset, limit, hasMore }',
      ].join('\n'),
      inputSchema: {
        tags: z.string().optional().describe('Comma-separated tags to filter by'),
        limit: z.number().int().min(1).max(100).optional().default(10).describe('Max results per page (default 10)'),
        offset: z.number().int().min(0).optional().default(0).describe('Skip first n results'),
        sort: z.enum(['time', 'access']).optional().default('time').describe('Sort by "time" or "access"'),
        after: z.string().optional().describe('Filter: created after this date (ISO 8601)'),
        before: z.string().optional().describe('Filter: created before this date (ISO 8601)'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ tags, limit, offset, sort, after, before }) => {
      try {
        const source = await getSource();
        const tagList = tags ? parseTags(tags) : undefined;
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
        const items = memories.map(m => ({
          id: m.id,
          digest: m.digest,
          tags: m.tags,
          createdAt: m.createdAt,
          accessCount: m.accessCount,
        }));
        return success({
          items,
          offset,
          limit,
          hasMore: memories.length === limit,
        });
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'memory_tags',
    {
      title: 'List Tags',
      description: [
        'List all tags with their usage counts.',
        '',
        'Returns: { tags: [{ tag, count }] }',
      ].join('\n'),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const source = await getSource();
        const tags = await source.tags();
        return success({ tags });
      } catch (e) {
        return error(e);
      }
    },
  );

  server.registerTool(
    'memory_stats',
    {
      title: 'Memory Statistics',
      description: [
        'Show memory store statistics including total memories, tags, storage size, and index status.',
        '',
        'Returns: { totalMemories, totalTags, storageSize?, indexStatus? }',
      ].join('\n'),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const source = await getSource();
        const stats = await source.stats();
        return success(stats as unknown as Record<string, unknown>);
      } catch (e) {
        return error(e);
      }
    },
  );
}
