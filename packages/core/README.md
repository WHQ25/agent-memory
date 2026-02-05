# @agent-memory/core

Core library for [agent-memory](https://github.com/WHQ25/agent-memory) — long-term, cross-project memory for AI agents.

Provides memory storage, hybrid search (FTS + vector), embedding, and configuration primitives.

## Install

```bash
npm install @agent-memory/core
```

## Usage

```typescript
import { SqliteSource, getDbPath } from '@agent-memory/core';

const source = new SqliteSource(getDbPath());
await source.init();

// Store
const mem = await source.add({
  content: 'Node 22 ESM has path resolution bug in monorepo',
  tags: ['node', 'esm'],
});

// Search (hybrid: FTS + vector)
const results = await source.search('ESM compatibility');

// Retrieve full content
const [full] = await source.get([results[0].id]);

await source.close();
```

## Exports

- **`SqliteSource`** — SQLite-backed memory source (FTS5 + sqlite-vec)
- **`MemorySource`** — Interface for implementing custom sources
- **Types** — `Memory`, `AddInput`, `UpdateInput`, `SearchOpts`, `ListOpts`, `SearchResult`, `TagCount`, `SourceStats`
- **Embedding** — `EmbeddingProvider`, `getTransformersProvider()` (nomic-embed-text-v1.5, 768 dims, local)
- **Search** — `searchPipeline()`, `rrfFuse()` (Reciprocal Rank Fusion)
- **Config** — `getDbPath()`, `getConfigDir()`, `loadConfig()`, `getConfigValue()`, `setConfigValue()`

## Search Pipeline

```
search(query)
  ├── FTS5 keyword search (always on)
  ├── Vector similarity search (when embeddings available)
  └── RRF Fusion: score = Σ 1/(k + rank_i), k=60
      → merged, deduplicated, sorted
      → post-filter by tags/date
```

## License

MIT
