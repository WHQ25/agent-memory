import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

export interface DbContext {
  db: Database.Database;
  vecAvailable: boolean;
}

export function openDatabase(dbPath: string): DbContext {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  let vecAvailable = false;
  try {
    sqliteVec.load(db);
    vecAvailable = true;
  } catch {
    // sqlite-vec not available, fall back to FTS-only
  }

  return { db, vecAvailable };
}

export function initSchema(ctx: DbContext): void {
  const { db, vecAvailable } = ctx;

  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id            TEXT PRIMARY KEY,
      hash          TEXT NOT NULL,
      content       TEXT NOT NULL,
      digest        TEXT NOT NULL,
      tags          TEXT DEFAULT '[]',
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      access_count  INTEGER DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_hash ON memories(hash);

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Standalone FTS5 table (not external content) to avoid rowid sync issues with TEXT PK
  const ftsExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='memories_fts'"
  ).get();
  if (!ftsExists) {
    db.exec(`
      CREATE VIRTUAL TABLE memories_fts USING fts5(id UNINDEXED, content, tags);
    `);
  }

  if (vecAvailable) {
    const vecExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='memories_vec'"
    ).get();
    if (!vecExists) {
      db.exec(`
        CREATE VIRTUAL TABLE memories_vec USING vec0(
          id TEXT PRIMARY KEY,
          embedding FLOAT[768]
        );
      `);
    }
  }
}
