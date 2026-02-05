#!/usr/bin/env node

import { Command } from 'commander';
import { registerMemoryCommands } from './commands/memory.js';
import { registerSearchCommand } from './commands/search.js';
import { registerListCommand } from './commands/list.js';
import { registerTagsCommand } from './commands/tags.js';
import { registerStatsCommand } from './commands/stats.js';
import { registerRunCommand } from './commands/run.js';
import { registerSourceCommand } from './commands/source.js';
import { registerConfigCommand } from './commands/config.js';
import { closeSource } from './middleware.js';

const program = new Command();

program
  .name('agmem')
  .description('Long-term, cross-project memory system for AI agents')
  .version('0.1.0')
  .option('--json', 'JSON output')
  .option('--human', 'Human-readable formatted output')
  .option('--source <name>', 'Target a specific source', 'local');

registerMemoryCommands(program);
registerSearchCommand(program);
registerListCommand(program);
registerTagsCommand(program);
registerStatsCommand(program);
registerRunCommand(program);
registerSourceCommand(program);
registerConfigCommand(program);

// Ensure source cleanup on exit
program.hook('postAction', async () => {
  await closeSource();
});

program.parseAsync(process.argv).catch(async (err: Error) => {
  console.error(`Error: ${err.message}`);
  await closeSource();
  process.exit(1);
});
