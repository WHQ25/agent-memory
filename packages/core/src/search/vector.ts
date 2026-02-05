import type Database from 'better-sqlite3';

export interface VectorResult {
  id: string;
  rank: number;
  distance: number;
}

export function searchVector(db: Database.Database, embedding: number[], limit: number): VectorResult[] {
  const buf = Buffer.from(new Float32Array(embedding).buffer);

  const rows = db.prepare(`
    SELECT id, distance
    FROM memories_vec
    WHERE embedding MATCH ? AND k = ?
    ORDER BY distance
  `).all(buf, limit) as Array<{ id: string; distance: number }>;

  return rows.map((r, i) => ({ id: r.id, rank: i + 1, distance: r.distance }));
}
