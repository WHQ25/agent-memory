import { Command, InvalidArgumentError } from 'commander';
import { resolveSource, injectMetadata } from '../middleware.js';
import { resolveFormat, output } from '../output.js';

function parseIntArg(value: string): number {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0) throw new InvalidArgumentError('Must be a non-negative integer.');
  return n;
}

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('Browse and filter memories')
    .option('--tags <tags>', 'Filter by comma-separated tags')
    .option('--after <date>', 'Filter by creation date (after)')
    .option('--before <date>', 'Filter by creation date (before)')
    .option('--limit <n>', 'Max results', parseIntArg, 10)
    .option('--offset <n>', 'Skip first n results', parseIntArg, 0)
    .option('--sort <field>', 'Sort by: time (default) or access', 'time')
    .action(async (opts: { tags?: string; after?: string; before?: string; limit: number; offset: number; sort: string }) => {
      const globalOpts = program.opts();
      const source = await resolveSource(globalOpts.source);
      const format = resolveFormat(globalOpts);
      const metadata = injectMetadata(globalOpts.source ?? 'local');

      const memories = await source.list({
        tags: opts.tags ? opts.tags.split(',').map(t => t.trim()) : undefined,
        after: opts.after,
        before: opts.before,
        limit: opts.limit,
        offset: opts.offset,
        sort: opts.sort as 'time' | 'access',
        metadata,
      });

      const summaries = memories.map(m => ({
        id: m.id,
        digest: m.digest,
        tags: m.tags,
        createdAt: m.createdAt,
        accessCount: m.accessCount,
      }));
      output(summaries, format);
    });
}
