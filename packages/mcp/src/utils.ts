export function success(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

export function error(e: unknown, guidance?: string) {
  const message = e instanceof Error ? e.message : String(e);
  const text = guidance ? `${message}. ${guidance}` : message;
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: text }) }],
    isError: true as const,
  };
}

export function parseTags(tags: string): string[] {
  return tags.split(',').map(t => t.trim()).filter(Boolean);
}

export function parseIds(ids: string): string[] {
  return ids.split(',').map(s => s.trim()).filter(Boolean);
}
