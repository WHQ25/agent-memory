import { describe, it, expect } from 'vitest';
import { formatOutput } from '../../packages/cli/src/format/index.js';
import type { Memory, SearchResult, TagCount, SourceStats } from '@agent-memory/core';

const mockMemory: Memory = {
  id: 'test-id',
  hash: 'test-hash',
  content: 'test content',
  digest: 'test digest',
  tags: ['tag1', 'tag2'],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  accessCount: 0,
};

describe('formatOutput', () => {
  describe('json', () => {
    it('should format as compact JSON', () => {
      const output = formatOutput(mockMemory, 'json');
      const parsed = JSON.parse(output);
      expect(parsed.id).toBe('test-id');
      expect(parsed.tags).toEqual(['tag1', 'tag2']);
    });

    it('should format arrays', () => {
      const output = formatOutput([mockMemory], 'json');
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].id).toBe('test-id');
    });
  });

  describe('human', () => {
    it('should format a memory with labeled fields', () => {
      const output = formatOutput(mockMemory, 'human');
      expect(output).toContain('ID:');
      expect(output).toContain('test-id');
      expect(output).toContain('tag1, tag2');
      expect(output).toContain('Content:');
    });

    it('should format search results', () => {
      const results: SearchResult[] = [
        { id: 'r1', digest: 'result 1', tags: ['a'], score: 0.87, createdAt: '2025-01-01T00:00:00Z' },
      ];
      const output = formatOutput(results, 'human');
      expect(output).toContain('r1');
      expect(output).toContain('result 1');
      expect(output).toContain('0.87');
    });

    it('should format tag counts', () => {
      const tags: TagCount[] = [
        { tag: 'node', count: 23 },
        { tag: 'react', count: 18 },
      ];
      const output = formatOutput(tags, 'human');
      expect(output).toContain('node');
      expect(output).toContain('(23)');
    });

    it('should format stats', () => {
      const stats: SourceStats = {
        totalMemories: 142,
        totalTags: 25,
        storageSize: 2411724,
        indexStatus: { indexed: 138, total: 142, model: 'nomic-embed-text' },
      };
      const output = formatOutput(stats, 'human');
      expect(output).toContain('Total memories: 142');
      expect(output).toContain('138/142');
      expect(output).toContain('nomic-embed-text');
    });
  });

  describe('toon', () => {
    it('should produce TOON output', () => {
      const output = formatOutput(mockMemory, 'toon');
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
      // TOON format should be more compact than JSON
      const jsonOutput = formatOutput(mockMemory, 'json');
      expect(output.length).toBeLessThanOrEqual(jsonOutput.length);
    });
  });
});
