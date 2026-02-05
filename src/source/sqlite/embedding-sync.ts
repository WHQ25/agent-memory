import type Database from 'better-sqlite3';
import type { EmbeddingProvider } from '../../embedding/interface.js';
import { buildEmbeddingText } from '../../embedding/transformers.js';
import { setMeta } from './meta.js';

interface UnembeddedRow {
  id: string;
  content: string;
  tags: string;
}

export async function indexUnembedded(
  db: Database.Database,
  embeddingProvider: EmbeddingProvider,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const rows = db.prepare(`
    SELECT m.id, m.content, m.tags
    FROM memories m
    LEFT JOIN memories_vec v ON m.id = v.id
    WHERE v.id IS NULL
  `).all() as UnembeddedRow[];

  if (rows.length === 0) return 0;

  const insertVec = db.prepare(`
    INSERT INTO memories_vec (id, embedding) VALUES (?, ?)
  `);

  let done = 0;
  for (const row of rows) {
    const tags = JSON.parse(row.tags || '[]') as string[];
    const text = buildEmbeddingText(row.content, tags);
    const embedding = await embeddingProvider.embed(text);
    const buf = Buffer.from(new Float32Array(embedding).buffer);
    insertVec.run(row.id, buf);
    done++;
    onProgress?.(done, rows.length);
  }

  setMeta(db, 'embedding.model', embeddingProvider.modelName);
  return done;
}

export async function rebuildIndex(
  db: Database.Database,
  embeddingProvider: EmbeddingProvider,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const rows = db.prepare('SELECT id, content, tags FROM memories').all() as UnembeddedRow[];
  if (rows.length === 0) return 0;

  // Build into temp table, then atomic swap — old index stays intact on failure
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_vec_new USING vec0(
      id TEXT PRIMARY KEY,
      embedding FLOAT[768]
    );
    DELETE FROM memories_vec_new;
  `);

  const insertVec = db.prepare(`
    INSERT INTO memories_vec_new (id, embedding) VALUES (?, ?)
  `);

  let done = 0;
  for (const row of rows) {
    const tags = JSON.parse(row.tags || '[]') as string[];
    const text = buildEmbeddingText(row.content, tags);
    const embedding = await embeddingProvider.embed(text);
    const buf = Buffer.from(new Float32Array(embedding).buffer);
    insertVec.run(row.id, buf);
    done++;
    onProgress?.(done, rows.length);
  }

  // Atomic swap
  db.transaction(() => {
    db.exec('DROP TABLE memories_vec');
    db.exec('ALTER TABLE memories_vec_new RENAME TO memories_vec');
    setMeta(db, 'embedding.model', embeddingProvider.modelName);
  })();

  return done;
}
