import type Database from 'better-sqlite3';
import type { SourceStats } from '../interface.js';
import { getMeta } from './meta.js';

export function getStats(db: Database.Database, dbPath: string, vecAvailable: boolean): SourceStats {
  const totalRow = db.prepare('SELECT COUNT(*) AS count FROM memories').get() as { count: number };
  const totalMemories = totalRow.count;

  const tagRow = db.prepare(`
    SELECT COUNT(DISTINCT json_each.value) AS count
    FROM memories, json_each(memories.tags)
  `).get() as { count: number };
  const totalTags = tagRow.count;

  let storageSize: number | undefined;
  try {
    const sizeRow = db.prepare('SELECT page_count * page_size AS size FROM pragma_page_count(), pragma_page_size()').get() as { size: number };
    storageSize = sizeRow.size;
  } catch {
    // ignore
  }

  let indexStatus: SourceStats['indexStatus'];
  if (vecAvailable) {
    try {
      const indexedRow = db.prepare('SELECT COUNT(*) AS count FROM memories_vec').get() as { count: number };
      const model = getMeta(db, 'embedding.model');
      indexStatus = {
        indexed: indexedRow.count,
        total: totalMemories,
        model,
      };
    } catch {
      // memories_vec may not exist
    }
  }

  return { totalMemories, totalTags, storageSize, indexStatus };
}
