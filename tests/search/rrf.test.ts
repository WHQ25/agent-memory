import { describe, it, expect } from 'vitest';
import { rrfFuse } from '@agent-memory/core';

describe('rrfFuse', () => {
  it('should fuse single ranking', () => {
    const results = rrfFuse([
      { id: 'a', rank: 1 },
      { id: 'b', rank: 2 },
      { id: 'c', rank: 3 },
    ]);

    expect(results[0].id).toBe('a');
    expect(results[1].id).toBe('b');
    expect(results[2].id).toBe('c');
  });

  it('should combine scores from multiple rankings', () => {
    const results = rrfFuse(
      [{ id: 'a', rank: 1 }, { id: 'b', rank: 2 }],
      [{ id: 'b', rank: 1 }, { id: 'c', rank: 2 }],
    );

    // b appears in both, should have highest score
    expect(results[0].id).toBe('b');
  });

  it('should handle empty rankings', () => {
    const results = rrfFuse([], []);
    expect(results).toEqual([]);
  });

  it('should use k=60 for scoring', () => {
    const results = rrfFuse(
      [{ id: 'a', rank: 1 }],
    );

    // score = 1/(60+1) ≈ 0.01639
    expect(results[0].score).toBeCloseTo(1 / 61, 5);
  });
});
