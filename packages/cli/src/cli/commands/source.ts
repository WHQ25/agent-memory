import { Command } from 'commander';
import { resolveFormat, output } from '../output.js';

export function registerSourceCommand(program: Command): void {
  const sourceCmd = program
    .command('source')
    .description('Manage sources');

  sourceCmd
    .command('list')
    .description('List configured sources')
    .action(() => {
      const globalOpts = program.opts();
      const format = resolveFormat(globalOpts);

      // Currently only local source is supported
      const sources = [
        { name: 'local', type: 'sqlite', active: true },
      ];
      output(sources, format);
    });
}
