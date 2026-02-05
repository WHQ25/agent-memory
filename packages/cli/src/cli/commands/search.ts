import { Command, InvalidArgumentError } from 'commander';
import { resolveSource, injectMetadata } from '../middleware.js';
import { resolveFormat, output } from '../output.js';

function parseIntArg(value: string): number {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0) throw new InvalidArgumentError('Must be a non-negative integer.');
  return n;
}

export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search memories')
    .option('--tags <tags>', 'Filter by comma-separated tags')
    .option('--after <date>', 'Filter by creation date (after)')
    .option('--before <date>', 'Filter by creation date (before)')
    .option('--limit <n>', 'Max results', parseIntArg, 10)
    .action(async (query: string, opts: { tags?: string; after?: string; before?: string; limit: number }) => {
      const globalOpts = program.opts();
      const source = await resolveSource(globalOpts.source);
      const format = resolveFormat(globalOpts);
      const metadata = injectMetadata(globalOpts.source ?? 'local');

      const results = await source.search(query, {
        tags: opts.tags ? opts.tags.split(',').map(t => t.trim()) : undefined,
        after: opts.after,
        before: opts.before,
        limit: opts.limit,
        metadata,
      });

      output(results, format);
    });
}
