import { formatJson } from './json.js';
import { formatToon } from './toon.js';
import { formatHuman } from './human.js';

export type OutputFormat = 'toon' | 'json' | 'human';

export function formatOutput(data: unknown, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(data);
    case 'human':
      return formatHuman(data);
    case 'toon':
    default:
      return formatToon(data);
  }
}
