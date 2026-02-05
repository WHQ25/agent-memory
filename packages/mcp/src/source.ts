import { SqliteSource, getDbPath, getSourceMetadata } from '@agent-memory/core';

let source: SqliteSource | null = null;

export async function resolveSource(_sourceName?: string): Promise<SqliteSource> {
  if (!source) {
    source = new SqliteSource(getDbPath());
    await source.init();
  }
  return source;
}

export async function closeSource(): Promise<void> {
  if (source) {
    await source.close();
    source = null;
  }
}

export function injectMetadata(sourceName: string): Record<string, string> {
  return getSourceMetadata(sourceName);
}
