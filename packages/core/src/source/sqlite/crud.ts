import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Memory, AddInput, UpdateInput } from '../interface.js';
import { hashContent } from './hash.js';

interface MemoryRow {
  id: string;
  hash: string;
  content: string;
  digest: string;
  tags: string;
  created_at: string;
  updated_at: string;
  access_count: number;
}

export function rowToMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    hash: row.hash,
    content: row.content,
    digest: row.digest,
    tags: JSON.parse(row.tags || '[]') as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accessCount: row.access_count,
  };
}

export function addMemory(db: Database.Database, input: AddInput): Memory {
  const hash = hashContent(input.content);
  const id = uuidv4();
  const now = new Date().toISOString();
  const tags = JSON.stringify(input.tags ?? []);
  const digest = input.digest ?? input.content;

  const selectByHash = db.prepare('SELECT * FROM memories WHERE hash = ?');
  const insertMemory = db.prepare(`
    INSERT INTO memories (id, hash, content, digest, tags, created_at, updated_at, access_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `);
  const insertFts = db.prepare(`
    INSERT INTO memories_fts (id, content, tags) VALUES (?, ?, ?)
  `);

  // Dedup check + insert in one transaction to prevent race condition
  const txn = db.transaction(() => {
    const existing = selectByHash.get(hash) as MemoryRow | undefined;
    if (existing) return rowToMemory(existing);

    insertMemory.run(id, hash, input.content, digest, tags, now, now);
    insertFts.run(id, input.content, tags);
    return null;
  });

  const deduped = txn();
  if (deduped) return deduped;

  return { id, hash, content: input.content, digest, tags: input.tags ?? [], createdAt: now, updatedAt: now, accessCount: 0 };
}

export function getMemories(db: Database.Database, ids: string[]): Memory[] {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`).all(...ids) as MemoryRow[];

  // Increment access count
  const updateStmt = db.prepare('UPDATE memories SET access_count = access_count + 1 WHERE id = ?');
  const txn = db.transaction(() => {
    for (const row of rows) {
      updateStmt.run(row.id);
    }
  });
  txn();

  return rows.map(r => ({ ...rowToMemory(r), accessCount: r.access_count + 1 }));
}

export function updateMemory(db: Database.Database, id: string, patch: UpdateInput): Memory {
  const existing = db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow | undefined;
  if (!existing) {
    throw new Error(`Memory not found: ${id}`);
  }

  const now = new Date().toISOString();
  const content = patch.content ?? existing.content;
  const digest = patch.digest ?? existing.digest;
  const tags = patch.tags !== undefined ? JSON.stringify(patch.tags) : existing.tags;
  const hash = patch.content !== undefined ? hashContent(content) : existing.hash;

  const needsReembed = patch.content !== undefined || patch.tags !== undefined;

  const txn = db.transaction(() => {
    db.prepare(`
      UPDATE memories SET hash = ?, content = ?, digest = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).run(hash, content, digest, tags, now, id);

    // Resync FTS
    db.prepare('DELETE FROM memories_fts WHERE id = ?').run(id);
    db.prepare('INSERT INTO memories_fts (id, content, tags) VALUES (?, ?, ?)').run(id, content, tags);

    // If content or tags changed, remove old embedding so it gets re-indexed
    if (needsReembed) {
      try {
        db.prepare('DELETE FROM memories_vec WHERE id = ?').run(id);
      } catch {
        // memories_vec may not exist
      }
    }
  });
  txn();

  return {
    id,
    hash,
    content,
    digest,
    tags: JSON.parse(tags) as string[],
    createdAt: existing.created_at,
    updatedAt: now,
    accessCount: existing.access_count,
  };
}

export function deleteMemories(db: Database.Database, ids: string[]): void {
  if (ids.length === 0) return;

  const txn = db.transaction(() => {
    const delMemory = db.prepare('DELETE FROM memories WHERE id = ?');
    const delFts = db.prepare('DELETE FROM memories_fts WHERE id = ?');

    for (const id of ids) {
      delMemory.run(id);
      delFts.run(id);
      try {
        db.prepare('DELETE FROM memories_vec WHERE id = ?').run(id);
      } catch {
        // memories_vec may not exist
      }
    }
  });
  txn();
}
