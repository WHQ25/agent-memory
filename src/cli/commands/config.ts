import { Command } from 'commander';
import {
  getConfigValue, setConfigValue, deleteConfigValue, listConfig,
} from '../../config/config.js';
import { resolveFormat, output } from '../output.js';

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Manage configuration');

  configCmd
    .command('set <key> <value>')
    .description('Set a config value')
    .action((key: string, value: string) => {
      const globalOpts = program.opts();
      const format = resolveFormat(globalOpts);
      setConfigValue(key, value, globalOpts.source);
      output({ [key]: value }, format);
    });

  configCmd
    .command('get <key>')
    .description('Get a config value')
    .action((key: string) => {
      const globalOpts = program.opts();
      const format = resolveFormat(globalOpts);
      const value = getConfigValue(key, globalOpts.source);
      if (value === undefined) {
        console.error(`Config key not found: ${key}`);
        process.exit(1);
      }
      output({ [key]: value }, format);
    });

  configCmd
    .command('list')
    .description('List all config values')
    .action(() => {
      const globalOpts = program.opts();
      const format = resolveFormat(globalOpts);
      const values = listConfig(globalOpts.source);
      output(values, format);
    });

  configCmd
    .command('delete <key>')
    .description('Delete a config value')
    .action((key: string) => {
      const globalOpts = program.opts();
      const format = resolveFormat(globalOpts);
      deleteConfigValue(key, globalOpts.source);
      output({ deleted: key }, format);
    });
}
