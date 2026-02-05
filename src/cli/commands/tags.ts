import { Command } from 'commander';
import { resolveSource } from '../middleware.js';
import { resolveFormat, output } from '../output.js';

export function registerTagsCommand(program: Command): void {
  program
    .command('tags')
    .description('List all tags with usage count')
    .action(async () => {
      const globalOpts = program.opts();
      const source = await resolveSource(globalOpts.source);
      const format = resolveFormat(globalOpts);
      const tags = await source.tags();
      output(tags, format);
    });
}
