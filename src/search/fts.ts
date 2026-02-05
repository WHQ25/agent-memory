import type Database from 'better-sqlite3';

export interface FtsResult {
  id: string;
  rank: number;
}

export function searchFts(db: Database.Database, query: string, limit: number): FtsResult[] {
  // Tokenize and join with OR so partial matches work (e.g. "ESM compatibility")
  const tokens = query
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
  if (tokens.length === 0) return [];
  const safeQuery = tokens.join(' OR ');

  const rows = db.prepare(`
    SELECT id, rank
    FROM memories_fts
    WHERE memories_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(safeQuery, limit) as Array<{ id: string; rank: number }>;

  return rows.map((r, i) => ({ id: r.id, rank: i + 1 }));
}
