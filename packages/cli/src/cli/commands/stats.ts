import { Command } from 'commander';
import { resolveSource } from '../middleware.js';
import { resolveFormat, output } from '../output.js';

export function registerStatsCommand(program: Command): void {
  program
    .command('stats')
    .description('Show memory statistics')
    .action(async () => {
      const globalOpts = program.opts();
      const source = await resolveSource(globalOpts.source);
      const format = resolveFormat(globalOpts);
      const stats = await source.stats();
      output(stats, format);
    });
}
