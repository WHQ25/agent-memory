import type { Memory, SearchResult, TagCount, SourceStats } from '@agent-memory/core';

function formatMemory(m: Memory): string {
  const lines = [
    `ID:      ${m.id}`,
    `Hash:    ${m.hash}`,
    `Tags:    ${m.tags.length ? m.tags.join(', ') : '(none)'}`,
    `Digest:  ${m.digest}`,
    `Created: ${m.createdAt}`,
    `Updated: ${m.updatedAt}`,
    `Access:  ${m.accessCount}`,
    `Content:`,
    m.content,
  ];
  return lines.join('\n');
}

function formatSearchResult(r: SearchResult): string {
  const tags = r.tags.length ? `[${r.tags.join(', ')}]` : '';
  return `${r.id}  ${tags}  ${r.digest}  (${r.score.toFixed(2)})`;
}

function formatTagCount(t: TagCount): string {
  return `${t.tag.padEnd(20)} (${t.count})`;
}

function formatStats(s: SourceStats): string {
  const lines = [
    `Total memories: ${s.totalMemories}`,
    `Total tags:     ${s.totalTags}`,
  ];
  if (s.storageSize != null) {
    const mb = (s.storageSize / 1024 / 1024).toFixed(1);
    lines.push(`Storage:        ${mb} MB`);
  }
  if (s.indexStatus) {
    const model = s.indexStatus.model ?? 'unknown';
    lines.push(`Index:          ${s.indexStatus.indexed}/${s.indexStatus.total} indexed (${model})`);
  }
  return lines.join('\n');
}

export function formatHuman(data: unknown): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return '(empty)';
    const first = data[0];
    // SearchResult[]
    if ('score' in first && 'digest' in first) {
      return (data as SearchResult[]).map(formatSearchResult).join('\n');
    }
    // TagCount[]
    if ('tag' in first && 'count' in first) {
      return (data as TagCount[]).map(formatTagCount).join('\n');
    }
    // Memory[]
    if ('content' in first && 'hash' in first) {
      return (data as Memory[]).map(formatMemory).join('\n\n---\n\n');
    }
    return JSON.stringify(data, null, 2);
  }
  // Single Memory
  if (data && typeof data === 'object' && 'content' in data && 'hash' in data) {
    return formatMemory(data as Memory);
  }
  // SourceStats
  if (data && typeof data === 'object' && 'totalMemories' in data) {
    return formatStats(data as SourceStats);
  }
  return String(data);
}
