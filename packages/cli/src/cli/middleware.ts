import { SqliteSource, getDbPath, getSourceMetadata } from '@agent-memory/core';

let source: SqliteSource | null = null;

export async function resolveSource(_source?: string): Promise<SqliteSource> {
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

export function injectMetadata(source: string): Record<string, string> {
  return getSourceMetadata(source);
}

export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', reject);
  });
}
