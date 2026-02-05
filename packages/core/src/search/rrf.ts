const K = 60;

interface RankedItem {
  id: string;
  rank: number;
}

export interface RrfResult {
  id: string;
  score: number;
}

export function rrfFuse(...rankings: RankedItem[][]): RrfResult[] {
  const scores = new Map<string, number>();

  for (const ranking of rankings) {
    for (const item of ranking) {
      const current = scores.get(item.id) ?? 0;
      scores.set(item.id, current + 1 / (K + item.rank));
    }
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
