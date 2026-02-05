import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteSource } from '../../src/source/sqlite/index.js';
import type { Memory } from '../../src/source/interface.js';

describe('SqliteSource', () => {
  let source: SqliteSource;

  beforeEach(async () => {
    source = new SqliteSource(':memory:');
    await source.init();
  });

  afterEach(async () => {
    await source.close();
  });

  describe('add', () => {
    it('should add a memory and return it', async () => {
      const mem = await source.add({
        content: 'test content',
        tags: ['tag1', 'tag2'],
        metadata: {},
      });

      expect(mem.id).toBeDefined();
      expect(mem.content).toBe('test content');
      expect(mem.digest).toBe('test content');
      expect(mem.tags).toEqual(['tag1', 'tag2']);
      expect(mem.accessCount).toBe(0);
      expect(mem.hash).toBeDefined();
    });

    it('should use digest when provided', async () => {
      const mem = await source.add({
        content: 'long detailed content here',
        digest: 'short summary',
        tags: [],
        metadata: {},
      });

      expect(mem.digest).toBe('short summary');
      expect(mem.content).toBe('long detailed content here');
    });

    it('should deduplicate by content hash', async () => {
      const mem1 = await source.add({ content: 'same content', metadata: {} });
      const mem2 = await source.add({ content: 'same content', metadata: {} });

      expect(mem1.id).toBe(mem2.id);
      expect(mem1.hash).toBe(mem2.hash);
    });
  });

  describe('get', () => {
    it('should retrieve memories by ID and increment access count', async () => {
      const mem = await source.add({ content: 'get test', metadata: {} });
      const [retrieved] = await source.get([mem.id]);

      expect(retrieved.id).toBe(mem.id);
      expect(retrieved.content).toBe('get test');
      expect(retrieved.accessCount).toBe(1);
    });

    it('should return empty array for non-existent IDs', async () => {
      const result = await source.get(['non-existent-id']);
      expect(result).toEqual([]);
    });

    it('should retrieve multiple memories', async () => {
      const mem1 = await source.add({ content: 'first', metadata: {} });
      const mem2 = await source.add({ content: 'second', metadata: {} });
      const result = await source.get([mem1.id, mem2.id]);

      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update content and rehash', async () => {
      const mem = await source.add({ content: 'original', metadata: {} });
      const updated = await source.update(mem.id, { content: 'updated', metadata: {} });

      expect(updated.content).toBe('updated');
      expect(updated.hash).not.toBe(mem.hash);
      expect(updated.id).toBe(mem.id);
    });

    it('should update tags', async () => {
      const mem = await source.add({ content: 'tagged', tags: ['old'], metadata: {} });
      const updated = await source.update(mem.id, { tags: ['new1', 'new2'], metadata: {} });

      expect(updated.tags).toEqual(['new1', 'new2']);
    });

    it('should update digest only', async () => {
      const mem = await source.add({ content: 'content', metadata: {} });
      const updated = await source.update(mem.id, { digest: 'new digest', metadata: {} });

      expect(updated.digest).toBe('new digest');
      expect(updated.content).toBe('content');
    });

    it('should throw for non-existent memory', async () => {
      await expect(
        source.update('non-existent', { content: 'x', metadata: {} })
      ).rejects.toThrow('Memory not found');
    });
  });

  describe('delete', () => {
    it('should delete memories', async () => {
      const mem = await source.add({ content: 'to delete', metadata: {} });
      await source.delete([mem.id]);

      const result = await source.get([mem.id]);
      expect(result).toEqual([]);
    });
  });

  describe('list', () => {
    let mems: Memory[];

    beforeEach(async () => {
      mems = [];
      mems.push(await source.add({ content: 'first', tags: ['a', 'b'], metadata: {} }));
      mems.push(await source.add({ content: 'second', tags: ['b', 'c'], metadata: {} }));
      mems.push(await source.add({ content: 'third', tags: ['a', 'c'], metadata: {} }));
    });

    it('should list all memories', async () => {
      const result = await source.list({ metadata: {} });
      expect(result).toHaveLength(3);
    });

    it('should filter by tags', async () => {
      const result = await source.list({ tags: ['a'], metadata: {} });
      expect(result).toHaveLength(2);
    });

    it('should filter by multiple tags (AND)', async () => {
      const result = await source.list({ tags: ['a', 'b'], metadata: {} });
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('first');
    });

    it('should respect limit', async () => {
      const result = await source.list({ limit: 2, metadata: {} });
      expect(result).toHaveLength(2);
    });

    it('should respect offset', async () => {
      const all = await source.list({ metadata: {} });
      const offset = await source.list({ offset: 1, metadata: {} });
      expect(offset).toHaveLength(2);
      expect(offset[0].id).toBe(all[1].id);
    });

    it('should sort by access count', async () => {
      // Access one memory to bump its count
      await source.get([mems[0].id]);
      const result = await source.list({ sort: 'access', metadata: {} });
      expect(result[0].id).toBe(mems[0].id);
    });
  });

  describe('tags', () => {
    it('should aggregate tags with counts', async () => {
      await source.add({ content: 'a', tags: ['node', 'esm'], metadata: {} });
      await source.add({ content: 'b', tags: ['node', 'react'], metadata: {} });
      await source.add({ content: 'c', tags: ['react', 'hooks'], metadata: {} });

      const tags = await source.tags();
      const nodeTag = tags.find(t => t.tag === 'node');
      const reactTag = tags.find(t => t.tag === 'react');
      const esmTag = tags.find(t => t.tag === 'esm');

      expect(nodeTag?.count).toBe(2);
      expect(reactTag?.count).toBe(2);
      expect(esmTag?.count).toBe(1);
    });
  });

  describe('stats', () => {
    it('should return correct stats', async () => {
      await source.add({ content: 'a', tags: ['tag1'], metadata: {} });
      await source.add({ content: 'b', tags: ['tag2', 'tag3'], metadata: {} });

      const stats = await source.stats();
      expect(stats.totalMemories).toBe(2);
      expect(stats.totalTags).toBe(3);
    });
  });

  describe('search', () => {
    it('should find memories by keyword', async () => {
      await source.add({ content: 'Node ESM has a path resolution bug', tags: ['node'], metadata: {} });
      await source.add({ content: 'React hooks are powerful', tags: ['react'], metadata: {} });

      const results = await source.search('ESM', { metadata: {} });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].digest).toContain('ESM');
    });

    it('should search with OR across terms', async () => {
      await source.add({ content: 'Node ESM module system', tags: ['node'], metadata: {} });
      await source.add({ content: 'compatibility layer for imports', tags: ['node'], metadata: {} });

      const results = await source.search('ESM compatibility', { metadata: {} });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should update search index on content change', async () => {
      await source.add({ content: 'quantum physics particle accelerator', tags: ['science'], metadata: {} });
      const mem = await source.add({ content: 'old content about cats', metadata: {} });
      await source.update(mem.id, { content: 'french pastry baking techniques', metadata: {} });

      // New content should be findable
      const newResults = await source.search('pastry baking', { metadata: {} });
      expect(newResults.length).toBeGreaterThanOrEqual(1);
      expect(newResults[0].id).toBe(mem.id);
    });

    it('should remove from FTS on delete', async () => {
      const mem = await source.add({ content: 'searchable content xyz', metadata: {} });
      await source.delete([mem.id]);

      const results = await source.search('xyz', { metadata: {} });
      expect(results).toHaveLength(0);
    });
  });

  describe('commands', () => {
    it('should return available commands', () => {
      const cmds = source.commands();
      expect(cmds.length).toBeGreaterThan(0);
      expect(cmds.map(c => c.name)).toContain('init');
      expect(cmds.map(c => c.name)).toContain('embed');
      expect(cmds.map(c => c.name)).toContain('embed-status');
    });

    it('should throw for unknown command', async () => {
      await expect(source.run('unknown')).rejects.toThrow('Unknown command: unknown');
    });
  });
});
