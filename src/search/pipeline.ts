import type Database from 'better-sqlite3';
import type { SearchResult, SearchOpts } from '../source/interface.js';
import type { EmbeddingProvider } from '../embedding/interface.js';
import { searchFts } from './fts.js';
import { searchVector } from './vector.js';
import { rrfFuse } from './rrf.js';
import { buildQueryText } from '../embedding/transformers.js';

export async function searchPipeline(
  db: Database.Database,
  query: string,
  opts: SearchOpts,
  vecAvailable: boolean,
  embeddingProvider?: EmbeddingProvider,
): Promise<SearchResult[]> {
  const limit = opts.limit ?? 10;
  // Fetch more candidates for fusion then trim
  const fetchLimit = Math.max(limit * 3, 30);

  // Always run FTS
  const ftsResults = searchFts(db, query, fetchLimit);

  // Optionally run vector search
  let vectorResults: { id: string; rank: number }[] = [];
  if (vecAvailable && embeddingProvider) {
    try {
      const queryEmbedding = await embeddingProvider.embed(buildQueryText(query));
      vectorResults = searchVector(db, queryEmbedding, fetchLimit);
    } catch {
      // Vector search failed, continue with FTS only
    }
  }

  // Fuse results
  const rankings = [ftsResults];
  if (vectorResults.length > 0) {
    rankings.push(vectorResults);
  }
  const fused = rrfFuse(...rankings);

  // Fetch metadata for fused results
  const topIds = fused.slice(0, fetchLimit).map(r => r.id);
  if (topIds.length === 0) return [];

  const placeholders = topIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT id, digest, tags, created_at FROM memories WHERE id IN (${placeholders})
  `).all(...topIds) as Array<{ id: string; digest: string; tags: string; created_at: string }>;

  const rowMap = new Map(rows.map(r => [r.id, r]));

  let results: SearchResult[] = fused
    .filter(r => rowMap.has(r.id))
    .map(r => {
      const row = rowMap.get(r.id)!;
      const tags = JSON.parse(row.tags || '[]') as string[];
      return {
        id: r.id,
        digest: row.digest,
        tags,
        score: r.score,
        createdAt: row.created_at,
      };
    });

  // Apply post-filters
  if (opts.tags && opts.tags.length > 0) {
    results = results.filter(r =>
      opts.tags!.every(t => r.tags.includes(t))
    );
  }
  if (opts.after) {
    results = results.filter(r => r.createdAt >= opts.after!);
  }
  if (opts.before) {
    results = results.filter(r => r.createdAt <= opts.before!);
  }

  return results.slice(0, limit);
}
