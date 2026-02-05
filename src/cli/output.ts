import { formatOutput, type OutputFormat } from '../format/index.js';

export function resolveFormat(opts: { json?: boolean; human?: boolean }): OutputFormat {
  if (opts.json) return 'json';
  if (opts.human) return 'human';
  return 'toon';
}

export function output(data: unknown, format: OutputFormat): void {
  process.stdout.write(formatOutput(data, format) + '\n');
}
