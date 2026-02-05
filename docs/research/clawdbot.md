# clawdbot (openclaw) Research

> AI Agent framework with built-in memory search module. NPM: `openclaw`
> Repo: https://github.com/nicobailon/clawdbot

## Overview

General-purpose AI agent framework where memory is a **built-in module** that indexes markdown files and session transcripts into a searchable vector + keyword store. Uses SQLite with sqlite-vec extension for in-process vector search. Memory is exposed to agents as tools (`memory_search`, `memory_get`).

## Architecture

```
Agent Runtime
  → MemoryIndexManager (Singleton per agent+workspace)
  → SQLite DB (~/.openclaw/state/memory/{agentId}.sqlite)
    ├── chunks table (text + embedding)
    ├── chunks_vec (sqlite-vec virtual table)
    └── chunks_fts (FTS5 virtual table)
  → Embedding Provider (OpenAI / Gemini / Local)
  → File Watcher (Chokidar)
```

### Tech Stack

- Runtime: Node.js 22+
- Language: TypeScript
- Database: SQLite + sqlite-vec extension + FTS5
- Embedding: OpenAI / Google Gemini / node-llama-cpp (local)
- File Watching: Chokidar
- Config: Hierarchical (global defaults → per-agent overrides)

## Data Model

### Schema

**meta** — Key-value metadata (embedding model, provider, chunk tokens, vector dims)

**files** — Indexed file tracking

| Field | Description |
|-------|-------------|
| path | Relative path (PRIMARY KEY) |
| source | "memory" or "sessions" |
| hash | SHA256 of file content (change detection) |
| mtime / size | File metadata |

**chunks** — Text segments with embeddings

| Field | Description |
|-------|-------------|
| id | SHA256(source:path:startLine:endLine:hash:model) |
| path / source | File reference |
| start_line / end_line | Line range (1-indexed) |
| text | Actual chunk content |
| hash | SHA256(chunk text) |
| model | Embedding model used |
| embedding | JSON stringified float32 vector |

**chunks_vec** — sqlite-vec virtual table (FLOAT[N] vectors)

**chunks_fts** — FTS5 virtual table on chunk text

**embedding_cache** — Avoids recomputation (provider + model + hash → embedding)

### Chunking Strategy

- Line-based splitting
- Default: 400 tokens per chunk, 80 token overlap
- Estimation: 4 chars ≈ 1 token
- Preserves line numbers for source mapping

## Memory Lifecycle

### Sources

- `memory`: MEMORY.md, memory.md, memory/*.md, extraPaths
- `sessions`: Session transcripts (JSONL format, experimental)

### Sync Triggers

| Trigger | When |
|---------|------|
| Watch | File changes (debounce 1.5s) |
| Session | New messages (delta bytes/count threshold) |
| Search | On-demand sync before searching |
| Start | Warm-up sync on session init |
| Interval | Periodic (configurable, disabled by default) |
| Manual | Force reindex |

### Sync Flow

1. Load sqlite-vec extension (30s timeout)
2. Check metadata — detect config changes requiring full reindex
3. If full reindex needed → `runSafeReindex()` (atomic temp DB swap)
4. Otherwise: incremental sync
5. For each file: **SHA256 hash check**, skip if unchanged
6. Concurrent indexing (default 4 workers)
7. Clean stale entries (files in DB but not on disk)

### Embedding Process

1. Check cache (SHA256(text) → cached embedding)
2. Build batches (max 8000 tokens)
3. Provider-specific batching:
   - OpenAI: Batch API (async jobs + polling)
   - Gemini: Batch embedding endpoint
   - Local: Immediate processing
4. Retry: 3 attempts, exponential backoff (500ms → 8s)
5. Cache new embeddings, prune old by recency

### No Explicit Expiration

- Embeddings persist until source file changes
- Config changes (provider, model) force full reindex
- Cache pruned by `updated_at` when exceeding `maxEntries`

## Search Architecture

### Hybrid Search (Default)

```
Query
  ├── Vector Search (sqlite-vec cosine distance)
  │   score = 1 - cosine_distance
  │   weight: 70% (configurable)
  │
  ├── Keyword Search (FTS5 BM25)
  │   score = 1 / (1 + bm25_rank)
  │   weight: 30% (configurable)
  │
  └── Merge
      → Deduplicate by chunk ID
      → Combined: vectorWeight × vectorScore + textWeight × textScore
      → Filter: minScore (default 0.35)
      → Sort descending, limit maxResults (default 6)
```

### Fallback Chain

- sqlite-vec unavailable → CPU-based cosine similarity (all in-memory)
- FTS5 unavailable → vector-only search
- Both unavailable → no search capability

### Search Parameters

```typescript
{
  maxResults: 6,           // default
  minScore: 0.35,          // threshold
  hybrid: {
    enabled: true,
    vectorWeight: 0.7,
    textWeight: 0.3,
    candidateMultiplier: 4  // retrieve 4x, then merge
  }
}
```

## Agent Integration

### Tools

```typescript
// Semantic search
memory_search({ query, maxResults?, minScore? })
// Returns: [{ path, startLine, endLine, score, snippet, source }]

// File reading with line range
memory_get({ relPath, from?, lines? })
// Returns: file content (bounded)
```

### Manager API

```typescript
const manager = await MemoryIndexManager.get({ cfg, agentId })
await manager.search(query, opts)
await manager.readFile({ relPath, from?, lines? })
await manager.sync({ reason?, force?, progress? })
manager.status()
```

### No MCP — tool-based integration only.

## Embedding Providers

### Interface

```typescript
type EmbeddingProvider = {
  id: string              // "openai" | "local" | "gemini"
  model: string
  embedQuery(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
}
```

### Implementations

| Provider | Default Model | Notes |
|----------|--------------|-------|
| OpenAI | text-embedding-3-small | Batch API support, custom baseUrl |
| Gemini | embedding-001 | Batch endpoint |
| Local | embeddinggemma-300M (GGUF) | node-llama-cpp, optional |

### Selection Strategy

```
auto mode: local (if model exists) → openai → gemini → error
explicit: direct provider + fallback chain
fallback: triggers full reindex with new provider
```

## Configuration

```typescript
{
  enabled: boolean,
  sources: ["memory", "sessions"],
  extraPaths: string[],
  provider: "openai" | "local" | "gemini" | "auto",
  fallback: "openai" | "gemini" | "local" | "none",
  model: string,
  store: { driver: "sqlite", path, vector: { enabled, extensionPath? } },
  chunking: { tokens: 400, overlap: 80 },
  sync: {
    onSessionStart, onSearch, watch,
    watchDebounceMs: 1500,
    sessions: { deltaBytes, deltaMessages }
  },
  query: {
    maxResults: 6, minScore: 0.35,
    hybrid: { enabled, vectorWeight: 0.7, textWeight: 0.3, candidateMultiplier: 4 }
  },
  cache: { enabled, maxEntries? }
}
```

Resolved hierarchically: global defaults → per-agent overrides.

## Notable Design Decisions

### Strengths

- **sqlite-vec in-process** — No external vector DB dependency, single SQLite file
- **Atomic reindex** — Temp DB → swap → backup → rollback on error
- **Provider auto-fallback** — auto → local → openai → gemini
- **SHA256 change detection** — Skip unchanged files, efficient incremental sync
- **Hybrid search with configurable weights** — Balanced vector + keyword
- **Embedding cache** — Avoid recomputation across reindexes
- **Workspace boundary enforcement** — No directory traversal
- **Concurrent indexing** — 4 workers by default

### Weaknesses

- **Passive indexing only** — Can only index existing files, no structured write API
- **No memory CRUD** — No way for agent to `store` a new memory directly
- **No remote sync** — Local SQLite only
- **No memory metadata** — No tags, categories, scope — just raw text chunks
- **Chunk granularity only** — Can't store/retrieve atomic knowledge units
- **Tight framework coupling** — Built into openclaw, not standalone
- **No expiration / decay** — Only invalidated by file changes

## Key Takeaways for agmem

| What to Borrow | Why |
|----------------|-----|
| sqlite-vec for in-process vector search | No external dependency, single file |
| Atomic reindex (temp DB swap) | Safe rebuild, rollback on error |
| Embedding provider abstraction + fallback chain | Flexible, resilient |
| SHA256 hash for change detection | Efficient incremental operations |
| Hybrid search with configurable weights | Best of both worlds |
| Embedding cache layer | Avoid redundant API calls |
| Chunking with line-number preservation | Source traceability |

| What to Avoid | Why |
|---------------|-----|
| Read-only memory (no write API) | agmem needs agent-driven `store` |
| No structured metadata | agmem needs tags, scope, category |
| Framework-internal module | agmem must be standalone CLI |
| File-only data source | agmem memories are atomic units, not file chunks |
