import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { SqliteSource } from '@agent-memory/core';
import { createServer } from '../../packages/mcp/src/server.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

async function callTool(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as ToolResult;
  const text = result.content[0].text;
  return { ...result, data: JSON.parse(text) };
}

describe('MCP Tools', () => {
  let source: SqliteSource;
  let client: Client;
  let tempDir: string;
  let origXdgConfig: string | undefined;

  beforeEach(async () => {
    // Isolate config to temp directory
    tempDir = mkdtempSync(join(tmpdir(), 'agmem-mcp-test-'));
    origXdgConfig = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = join(tempDir, 'config');

    source = new SqliteSource(':memory:');
    await source.init();

    const server = createServer(source);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await source.close();

    // Restore XDG env
    if (origXdgConfig === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = origXdgConfig;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ─── memory_add ──────────────────────────────────────────

  describe('memory_add', () => {
    it('should add a memory and return summary without content', async () => {
      const { data } = await callTool(client, 'memory_add', {
        content: 'Test memory content',
        tags: 'bug,node',
        digest: 'A test memory',
      });

      expect(data.id).toBeDefined();
      expect(data.tags).toEqual(['bug', 'node']);
      expect(data.digest).toBe('A test memory');
      expect(data.content).toBeUndefined();
    });

    it('should auto-generate digest from content when not provided', async () => {
      const { data } = await callTool(client, 'memory_add', {
        content: 'Some content here',
      });

      expect(data.id).toBeDefined();
      expect(data.digest).toBe('Some content here');
    });
  });

  // ─── memory_get ──────────────────────────────────────────

  describe('memory_get', () => {
    it('should retrieve memory content by id', async () => {
      const { data: added } = await callTool(client, 'memory_add', {
        content: 'Get test content',
      });

      const { data } = await callTool(client, 'memory_get', { ids: added.id });

      expect(data.memories).toHaveLength(1);
      expect(data.memories[0].id).toBe(added.id);
      expect(data.memories[0].content).toBe('Get test content');
    });

    it('should return full metadata with full=true', async () => {
      const { data: added } = await callTool(client, 'memory_add', {
        content: 'Full metadata test',
        tags: 'test',
      });

      const { data } = await callTool(client, 'memory_get', {
        ids: added.id,
        full: true,
      });

      expect(data.memories).toHaveLength(1);
      expect(data.memories[0].id).toBe(added.id);
      expect(data.memories[0].content).toBe('Full metadata test');
      expect(data.memories[0].tags).toEqual(['test']);
      expect(data.memories[0].createdAt).toBeDefined();
      expect(data.memories[0].updatedAt).toBeDefined();
      expect(data.memories[0].accessCount).toBeGreaterThanOrEqual(1);
      expect(data.memories[0].hash).toBeDefined();
    });

    it('should return error with guidance for non-existent id', async () => {
      const result = await callTool(client, 'memory_get', {
        ids: 'non-existent-id',
      });

      expect(result.isError).toBe(true);
      expect(result.data.error).toContain('No memories found');
      expect(result.data.error).toContain('memory_list');
    });
  });

  // ─── memory_update ───────────────────────────────────────

  describe('memory_update', () => {
    it('should update tags and digest and return summary', async () => {
      const { data: added } = await callTool(client, 'memory_add', {
        content: 'Original content',
        tags: 'old',
        digest: 'Old digest',
      });

      const { data } = await callTool(client, 'memory_update', {
        id: added.id,
        tags: 'new,updated',
        digest: 'New digest',
      });

      expect(data.id).toBe(added.id);
      expect(data.tags).toEqual(['new', 'updated']);
      expect(data.digest).toBe('New digest');
      expect(data.content).toBeUndefined();
    });

    it('should update content', async () => {
      const { data: added } = await callTool(client, 'memory_add', {
        content: 'Original',
      });

      await callTool(client, 'memory_update', {
        id: added.id,
        content: 'Updated content',
      });

      const { data } = await callTool(client, 'memory_get', { ids: added.id });
      expect(data.memories[0].content).toBe('Updated content');
    });
  });

  // ─── memory_delete ───────────────────────────────────────

  describe('memory_delete', () => {
    it('should delete a memory and return deleted ids', async () => {
      const { data: added } = await callTool(client, 'memory_add', {
        content: 'To be deleted',
      });

      const { data } = await callTool(client, 'memory_delete', { ids: added.id });
      expect(data.deleted).toEqual([added.id]);
    });

    it('should not find deleted memory', async () => {
      const { data: added } = await callTool(client, 'memory_add', {
        content: 'Delete me',
      });

      await callTool(client, 'memory_delete', { ids: added.id });

      const result = await callTool(client, 'memory_get', { ids: added.id });
      expect(result.isError).toBe(true);
    });
  });

  // ─── memory_search ───────────────────────────────────────

  describe('memory_search', () => {
    it('should find memories by keyword with scores', async () => {
      await callTool(client, 'memory_add', {
        content: 'Node ESM has a path resolution bug',
        tags: 'node,esm',
      });
      await callTool(client, 'memory_add', {
        content: 'React hooks need cleanup',
        tags: 'react',
      });

      const { data } = await callTool(client, 'memory_search', {
        query: 'ESM path resolution',
      });

      expect(data.results.length).toBeGreaterThanOrEqual(1);
      expect(data.results[0].score).toBeDefined();
      expect(data.results[0].digest).toContain('ESM');
    });

    it('should filter by tags', async () => {
      await callTool(client, 'memory_add', {
        content: 'Node module bug',
        tags: 'node',
      });
      await callTool(client, 'memory_add', {
        content: 'React module bug',
        tags: 'react',
      });

      const { data } = await callTool(client, 'memory_search', {
        query: 'module bug',
        tags: 'node',
      });

      expect(data.results.length).toBeGreaterThanOrEqual(1);
      for (const result of data.results) {
        expect(result.tags).toContain('node');
      }
    });
  });

  // ─── memory_list ─────────────────────────────────────────

  describe('memory_list', () => {
    beforeEach(async () => {
      await callTool(client, 'memory_add', { content: 'First', tags: 'alpha,shared' });
      await callTool(client, 'memory_add', { content: 'Second', tags: 'beta,shared' });
      await callTool(client, 'memory_add', { content: 'Third', tags: 'gamma' });
    });

    it('should list all memories as summaries without content', async () => {
      const { data } = await callTool(client, 'memory_list', {});

      expect(data.items).toHaveLength(3);
      for (const item of data.items) {
        expect(item.id).toBeDefined();
        expect(item.digest).toBeDefined();
        expect(item.tags).toBeDefined();
        expect(item.content).toBeUndefined();
      }
    });

    it('should include pagination metadata', async () => {
      const { data } = await callTool(client, 'memory_list', {});

      expect(data.offset).toBe(0);
      expect(data.limit).toBe(10);
      expect(data.hasMore).toBe(false);
    });

    it('should set hasMore when result count equals limit', async () => {
      const { data } = await callTool(client, 'memory_list', { limit: 2 });

      expect(data.items).toHaveLength(2);
      expect(data.hasMore).toBe(true);
    });

    it('should filter by tag', async () => {
      const { data } = await callTool(client, 'memory_list', { tags: 'shared' });
      expect(data.items).toHaveLength(2);
    });

    it('should respect limit', async () => {
      const { data } = await callTool(client, 'memory_list', { limit: 2 });
      expect(data.items).toHaveLength(2);
    });

    it('should sort by access count', async () => {
      const { data: all } = await callTool(client, 'memory_list', {});
      // Bump access count for first memory
      await callTool(client, 'memory_get', { ids: all.items[0].id });

      const { data } = await callTool(client, 'memory_list', { sort: 'access' });
      expect(data.items[0].accessCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── memory_tags ─────────────────────────────────────────

  describe('memory_tags', () => {
    it('should return tags with usage counts', async () => {
      await callTool(client, 'memory_add', { content: 'A', tags: 'node,esm' });
      await callTool(client, 'memory_add', { content: 'B', tags: 'node,react' });

      const { data } = await callTool(client, 'memory_tags');

      const nodeTag = data.tags.find((t: { tag: string }) => t.tag === 'node');
      expect(nodeTag).toBeDefined();
      expect(nodeTag.count).toBe(2);

      const esmTag = data.tags.find((t: { tag: string }) => t.tag === 'esm');
      expect(esmTag).toBeDefined();
      expect(esmTag.count).toBe(1);
    });
  });

  // ─── memory_stats ────────────────────────────────────────

  describe('memory_stats', () => {
    it('should return correct statistics', async () => {
      await callTool(client, 'memory_add', { content: 'Memory one', tags: 'a' });
      await callTool(client, 'memory_add', { content: 'Memory two', tags: 'b,c' });

      const { data } = await callTool(client, 'memory_stats');

      expect(data.totalMemories).toBe(2);
      expect(data.totalTags).toBe(3);
    });
  });

  // ─── source_list ─────────────────────────────────────────

  describe('source_list', () => {
    it('should return local sqlite source', async () => {
      const { data } = await callTool(client, 'source_list');

      expect(data.sources).toEqual([
        { name: 'local', type: 'sqlite', active: true },
      ]);
    });
  });

  // ─── source_run ──────────────────────────────────────────

  describe('source_run', () => {
    it('should list available commands when no command given', async () => {
      const { data } = await callTool(client, 'source_run', {});

      expect(Array.isArray(data.commands)).toBe(true);
      expect(data.commands.length).toBeGreaterThan(0);
      const names = data.commands.map((c: { name: string }) => c.name);
      expect(names).toContain('init');
    });

    it('should run embed-status command', async () => {
      const { data } = await callTool(client, 'source_run', { command: 'embed-status' });

      expect(data.result.total).toBeGreaterThanOrEqual(0);
      expect(data.result.indexed).toBeGreaterThanOrEqual(0);
    });

    it('should return error with guidance for unknown command', async () => {
      const result = await callTool(client, 'source_run', { command: 'nonexistent' });

      expect(result.isError).toBe(true);
      expect(result.data.error).toContain('Unknown command');
      expect(result.data.error).toContain('Available commands');
    });
  });

  // ─── config_set / config_get / config_list / config_delete ───

  describe('config tools', () => {
    it('should set and get a config value', async () => {
      await callTool(client, 'config_set', {
        key: 'test.key',
        value: 'test-value',
      });

      const { data } = await callTool(client, 'config_get', { key: 'test.key' });
      expect(data.key).toBe('test.key');
      expect(data.value).toBe('test-value');
    });

    it('should list config values', async () => {
      await callTool(client, 'config_set', { key: 'a.key', value: 'val1' });
      await callTool(client, 'config_set', { key: 'b.key', value: 'val2' });

      const { data } = await callTool(client, 'config_list', {});

      expect(data.entries['a.key']).toBe('val1');
      expect(data.entries['b.key']).toBe('val2');
    });

    it('should delete a config value and verify it is gone', async () => {
      await callTool(client, 'config_set', { key: 'to.delete', value: 'temp' });

      const { data: deleteResult } = await callTool(client, 'config_delete', {
        key: 'to.delete',
      });
      expect(deleteResult.deleted).toBe('to.delete');

      const getResult = await callTool(client, 'config_get', { key: 'to.delete' });
      expect(getResult.isError).toBe(true);
      expect(getResult.data.error).toContain('not found');
    });

    it('should return error with guidance for non-existent config key', async () => {
      const result = await callTool(client, 'config_get', { key: 'does.not.exist' });

      expect(result.isError).toBe(true);
      expect(result.data.error).toContain('not found');
      expect(result.data.error).toContain('config_list');
    });
  });
});
