import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const CLI = join(import.meta.dirname, '../../packages/cli/dist/index.js');

describe('CLI E2E', () => {
  let tempDir: string;
  let env: Record<string, string>;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agmem-test-'));
    // Override env-paths by setting XDG dirs
    env = {
      ...process.env as Record<string, string>,
      XDG_CONFIG_HOME: join(tempDir, 'config'),
      XDG_DATA_HOME: join(tempDir, 'data'),
      XDG_CACHE_HOME: join(tempDir, 'cache'),
    };
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function run(...args: string[]): string {
    return execFileSync('node', [CLI, ...args, '--json'], {
      env,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
  }

  it('should show version', () => {
    const output = execFileSync('node', [CLI, '--version'], { env, encoding: 'utf-8' }).trim();
    expect(output).toBe('0.1.0');
  });

  it('should add, get, update, and delete a memory', () => {
    // Add
    const addResult = JSON.parse(run('add', 'e2e test memory', '--tags', 'test,e2e'));
    expect(addResult.id).toBeDefined();
    expect(addResult.tags).toEqual(['test', 'e2e']);

    // Get (default: id + content only)
    const getResult = JSON.parse(run('get', addResult.id));
    expect(getResult.content).toBe('e2e test memory');
    expect(getResult.accessCount).toBeUndefined();

    // Get --full (all metadata)
    const getFullResult = JSON.parse(run('get', addResult.id, '--full'));
    expect(getFullResult.accessCount).toBeGreaterThanOrEqual(2);

    // Update
    const updateResult = JSON.parse(run('update', addResult.id, '--tags', 'test,e2e,updated'));
    expect(updateResult.tags).toEqual(['test', 'e2e', 'updated']);

    // Delete
    const deleteResult = JSON.parse(run('delete', addResult.id));
    expect(deleteResult.deleted).toContain(addResult.id);
  });

  it('should list and search memories', () => {
    run('add', 'Node ESM has a path resolution bug', '--tags', 'node,esm');
    run('add', 'React hooks need cleanup', '--tags', 'react');

    // List
    const listResult = JSON.parse(run('list'));
    expect(listResult.length).toBeGreaterThanOrEqual(2);

    // Search
    const searchResult = JSON.parse(run('search', 'ESM'));
    expect(searchResult.length).toBeGreaterThan(0);
    expect(searchResult[0].digest).toContain('ESM');
  });

  it('should show tags and stats', () => {
    const tags = JSON.parse(run('tags'));
    expect(tags.length).toBeGreaterThan(0);

    const stats = JSON.parse(run('stats'));
    expect(stats.totalMemories).toBeGreaterThan(0);
  });

  it('should run source commands', () => {
    // List available commands
    const commands = JSON.parse(run('run'));
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.map((c: { name: string }) => c.name)).toContain('embed-status');

    // Run embed-status
    const status = JSON.parse(run('run', 'embed-status'));
    expect(status.total).toBeGreaterThanOrEqual(0);
    expect(status.indexed).toBeGreaterThanOrEqual(0);
  });

  it('should list sources', () => {
    const sources = JSON.parse(run('source', 'list'));
    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0].name).toBe('local');
  });

  it('should manage config', () => {
    run('config', 'set', 'test.key', 'test-value');

    const getResult = JSON.parse(run('config', 'get', 'test.key'));
    expect(getResult['test.key']).toBe('test-value');

    const listResult = JSON.parse(run('config', 'list'));
    expect(listResult['test.key']).toBe('test-value');

    run('config', 'delete', 'test.key');
    try {
      run('config', 'get', 'test.key');
      expect.fail('Should have thrown');
    } catch {
      // Expected - key not found
    }
  });
});
