import { encode } from '@toon-format/toon';

/**
 * Flatten array fields (like tags) to pipe-delimited strings
 * so TOON can use tabular mode for uniform object arrays.
 */
function flattenForTabular(data: unknown): unknown {
  if (!Array.isArray(data) || data.length === 0) return data;
  const first = data[0];
  if (typeof first !== 'object' || first === null) return data;

  return data.map((item: Record<string, unknown>) => {
    const flat: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      flat[key] = Array.isArray(value) ? value.join('|') : value;
    }
    return flat;
  });
}

export function formatToon(data: unknown): string {
  return encode(flattenForTabular(data));
}
