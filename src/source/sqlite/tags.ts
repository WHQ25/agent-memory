import type Database from 'better-sqlite3';
import type { TagCount } from '../interface.js';

export function getTags(db: Database.Database): TagCount[] {
  const rows = db.prepare(`
    SELECT json_each.value AS tag, COUNT(*) AS count
    FROM memories, json_each(memories.tags)
    GROUP BY json_each.value
    ORDER BY count DESC
  `).all() as Array<{ tag: string; count: number }>;

  return rows.map(r => ({ tag: r.tag, count: r.count }));
}
