import envPaths from 'env-paths';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const paths = envPaths('agmem');

function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getConfigDir(): string {
  return ensureDir(paths.config);
}

export function getDataDir(): string {
  return ensureDir(paths.data);
}

export function getCacheDir(): string {
  return ensureDir(paths.cache);
}

export function getDbPath(): string {
  return join(getDataDir(), 'memories.db');
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}
