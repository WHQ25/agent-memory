import { Command } from 'commander';
import { resolveSource } from '../middleware.js';
import { resolveFormat, output } from '../output.js';

export function registerRunCommand(program: Command): void {
  program
    .command('run [command]')
    .description('Run a source-provided command (omit command to list available commands)')
    .action(async (command: string | undefined) => {
      const globalOpts = program.opts();
      const source = await resolveSource(globalOpts.source);
      const format = resolveFormat(globalOpts);

      // No command: list available commands
      if (!command) {
        const cmds = source.commands();
        output(cmds, format);
        return;
      }

      // Validate command
      const available = source.commands();
      const match = available.find(c => c.name === command);
      if (!match) {
        const names = available.map(c => c.name).join(', ');
        console.error(`Error: Unknown command "${command}". Available: ${names}`);
        process.exit(1);
      }

      const result = await source.run(command, {
        onProgress: (msg) => process.stderr.write(`\r${msg}`),
      });

      // Write newline after progress messages
      process.stderr.write('\n');

      output(result, format);
    });
}
