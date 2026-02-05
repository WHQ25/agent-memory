import type Database from 'better-sqlite3';
import type { Memory, ListOpts } from '../interface.js';
import { rowToMemory } from './crud.js';

export function listMemories(db: Database.Database, opts: ListOpts = {}): Memory[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.tags && opts.tags.length > 0) {
    // Filter: memory must contain ALL specified tags
    for (const tag of opts.tags) {
      conditions.push(`EXISTS (SELECT 1 FROM json_each(memories.tags) WHERE json_each.value = ?)`);
      params.push(tag);
    }
  }

  if (opts.after) {
    conditions.push('created_at >= ?');
    params.push(opts.after);
  }

  if (opts.before) {
    conditions.push('created_at <= ?');
    params.push(opts.before);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sort = opts.sort === 'access' ? 'access_count DESC' : 'created_at DESC';
  const limit = opts.limit ?? 10;
  const offset = opts.offset ?? 0;

  const sql = `SELECT * FROM memories ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params) as Array<{
    id: string; hash: string; content: string; digest: string;
    tags: string; created_at: string; updated_at: string; access_count: number;
  }>;

  return rows.map(rowToMemory);
}
