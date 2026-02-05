# agmem CLI Design

`agmem` is the CLI interface for agent-memory. It is the primary way agents and developers interact with the memory system.

## Commands Overview

```
Core (universal):   add / get / update / delete / search / list / tags / stats
Config:             config set / get / list / delete   [--source name]
Source management:  source list
Source commands:    run <cmd>
```

## Global Flags

All commands support:

| Flag | Description |
|------|-------------|
| `--json` | JSON output |
| `--human` | Human-readable formatted output |
| `--source <name>` | Target a specific source (default: `local`) |
| `--help` | Help |

Default output is [TOON](https://github.com/toon-format/toon) (Token-Oriented Object Notation) — a compact format designed for LLM consumption, ~40% fewer tokens than JSON. Use `--json` for machine parsing, `--human` for human-readable display.

## Memory Operations

### `agmem add`

Write a new memory.

```bash
agmem add <content> [flags]
agmem add "useEffect cleanup must handle race conditions" --tags react,hooks
agmem add "detailed multi-paragraph content..." --digest "Short summary for search results" --tags node

# From stdin (long content or pipe)
echo "long experience notes" | agmem add --tags lesson
cat session.log | agmem add --tags session
```

| Flag | Description |
|------|-------------|
| `--tags <t1,t2>` | Comma-separated tags |
| `--digest <text>` | Short summary for search results. If omitted, digest = content |

Returns: created memory ID.

### `agmem get`

Retrieve memory by ID. Default returns `id` + `content` only (minimal tokens). Use `--full` for all metadata.

```bash
agmem get <id> [<id>...]
agmem get a3f2                # returns id + content
agmem get a3f2 --full         # returns all fields
agmem get a3f2 b7e1 --json
```

| Flag | Description |
|------|-------------|
| `--full` | Include all metadata (hash, digest, tags, dates, accessCount) |

### `agmem update`

Patch a memory. Only specified fields are changed.

```bash
agmem update <id> [flags]
agmem update a3f2 --tags node,esm,monorepo
agmem update a3f2 --content "corrected content"
agmem update a3f2 --digest "updated summary"

# Update content from stdin
echo "new content" | agmem update a3f2
```

| Flag | Description |
|------|-------------|
| `--content <text>` | Replace content (also accepts stdin) |
| `--digest <text>` | Replace digest |
| `--tags <t1,t2>` | Replace tags |

### `agmem delete`

Delete one or more memories by ID.

```bash
agmem delete <id> [<id>...]
agmem delete a3f2
agmem delete a3f2 b7e1 c9d3
```

### `agmem search`

Search memories by query. Uses hybrid retrieval: FTS keyword matching + vector semantic search, fused with RRF (Reciprocal Rank Fusion).

```bash
agmem search <query> [flags]
agmem search "ESM compatibility issue"
agmem search "database migration" --tags node --limit 5
agmem search "error handling" --after 2025-01-01 --json
```

| Flag | Description |
|------|-------------|
| `--tags <t1,t2>` | Filter results by tags |
| `--after <date>` | Filter by creation date |
| `--before <date>` | Filter by creation date |
| `--limit <n>` | Max results (default: 10) |

**Search results return `digest` (not full content).** Use `agmem get <id>` for full content. This is the progressive disclosure pattern — saves tokens for agents.

```bash
# Step 1: search returns digests + scores (default TOON format)
agmem search "ESM 兼容性"
results[2]{id,score,tags,digest}:
 a3f2,0.87,node|esm,Node 22 ESM has path resolution bug in monorepo
 b7e1,0.72,node|esm,ESM and CommonJS interop: __dirname not available in ESM

# Step 2: agent picks relevant ones, gets full content
agmem get a3f2
id: a3f2
tags: node,esm
digest: Node 22 ESM has path resolution bug in monorepo
content:
 Node 22 的 ESM 加载器在 monorepo 下有路径解析 bug...(full detail)...
```

**Retrieval behavior:**
- With embeddings available → hybrid (FTS + vector, RRF fusion)
- Without embeddings → FTS only (automatic fallback, transparent to user)

### `agmem list`

Browse and filter memories. No query, no ranking — just filtering and sorting. Returns summary fields only (`id`, `digest`, `tags`, `createdAt`, `accessCount`). Use `agmem get <id>` for full content.

```bash
agmem list [flags]
agmem list
agmem list --tags node,esm
agmem list --after 2025-01-01 --before 2025-06-01
agmem list --sort access --limit 20
agmem list --limit 20 --offset 40
```

| Flag | Description |
|------|-------------|
| `--tags <t1,t2>` | Filter by tags |
| `--after <date>` | Filter by creation date |
| `--before <date>` | Filter by creation date |
| `--limit <n>` | Max results (default: 10) |
| `--offset <n>` | Skip first n results |
| `--sort <field>` | `time` (default) / `access` |

## Tag Operations

### `agmem tags`

List all tags with usage count.

```bash
agmem tags
# node       (23)
# react      (18)
# hooks      (12)
# database   (8)
# esm        (5)
```

## Source Management

### `agmem source list`

List configured sources.

```bash
agmem source list
```

P1: `source add` / `source remove` will be implemented when remote sources are supported.

## Source Commands

### `agmem run [command]`

Run a source-provided command. Each source defines its own set of runnable commands. Without a command argument, lists all available commands for the current source.

```bash
# List available commands
agmem run

# Run a specific command
agmem run <command>
```

**Local source commands:**

| Command | Description |
|---------|-------------|
| `init` | Initialize source (download embedding model, etc.) |
| `status` | Show source status |
| `embed` | Generate embeddings for un-indexed memories |
| `embed-rebuild` | Full rebuild of all embeddings |
| `embed-status` | Show embedding index status |

```bash
# Initialize (download embedding model)
agmem run init

# Embed un-indexed memories
agmem run embed

# Full rebuild after model switch
agmem run embed-rebuild

# Check embedding status
agmem run embed-status

# Show source status
agmem run status
```

## Meta Operations

### `agmem stats`

Show memory statistics overview.

```bash
agmem stats
# Total memories: 142
# Tags: node(23) react(18) database(12) ...
# Index: 138/142 indexed (nomic-embed-text)
# Storage: 2.3 MB (memories.db)
```

### `agmem config`

Manage global and source-level configuration. Use `--source` to target a specific source's config. Source config KV pairs are automatically passed to the source as `metadata` on every operation.

```bash
# Global config
agmem config set <key> <value>
agmem config get <key>
agmem config list
agmem config delete <key>

# Source-specific config (passed to source as metadata)
agmem config set <key> <value> --source <name>
agmem config get <key> --source <name>
agmem config list --source <name>
agmem config delete <key> --source <name>

# Examples
agmem config set embedding.model nomic-embed-text
agmem config set default_source sqlite
agmem config set api_token ghp_xxxx --source team-gist
agmem config set contributor wuhangqi --source team-gist
```

When a command targets a source, the CLI injects that source's config KV pairs:

```bash
agmem search "ESM" --source team-gist
# → source.search("ESM", {
#     limit: 10,
#     metadata: { api_token: "ghp_xxxx", contributor: "wuhangqi" }
#   })
```

## Data Model

```typescript
interface Memory {
  id: string        // UUID v4, generated at creation, never changes
  hash: string      // SHA-256 of content, used for deduplication
  content: string
  digest: string
  tags: string[]
  createdAt: string
  updatedAt: string
  accessCount: number
}
```

- **id**: UUID v4, stable across updates, unique across sources
- **hash**: SHA-256 of content. On `add`, if a memory with the same hash exists, return the existing ID instead of creating a duplicate. Updated when content changes via `update`
- **content**: Full memory text, free-form granularity
- **digest**: Short summary for search results. If not provided at creation, equals content
- **tags**: Flat list for categorization. No fixed taxonomy — users define their own
- **accessCount**: Incremented on `get`. Enables future relevance decay

No `scope`, `project`, `language`, `source`, or `metadata` fields. Categorization is handled entirely via tags (e.g. `--tags project:my-api,typescript`). Source-level config (auth, auto-injected fields) is managed through `agmem config --source`, not stored on memories.

## Database Schema (SQLite Source Implementation)

```sql
-- Main table
CREATE TABLE memories (
  id            TEXT PRIMARY KEY,  -- UUID v4
  hash          TEXT NOT NULL,     -- SHA-256 of content, for dedup
  content       TEXT NOT NULL,
  digest        TEXT NOT NULL,
  tags          TEXT,              -- JSON array
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  access_count  INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX idx_memories_hash ON memories(hash);

-- Vector index (sqlite-vec virtual table)
CREATE VIRTUAL TABLE memories_vec USING vec0(
  id TEXT PRIMARY KEY,
  embedding FLOAT[768]
);

-- Full-text search index
CREATE VIRTUAL TABLE memories_fts USING fts5(
  content, tags,
  content=memories
);

-- Source metadata
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
```

## Source Interface

Each source is a self-contained memory source with its own storage, indexing, and search strategy. The CLI delegates operations to sources through a unified interface. Sources are composable — multiple can be configured simultaneously.

```typescript
interface SourceCommandMeta {
  name: string
  description: string
}

interface RunContext {
  onProgress?: (message: string) => void
}

interface MemorySource {
  readonly name: string
  readonly vecAvailable: boolean

  // Lifecycle
  init(): Promise<void>
  close(): Promise<void>

  // CRUD
  add(input: AddInput): Promise<Memory>
  get(ids: string[]): Promise<Memory[]>
  update(id: string, patch: UpdateInput): Promise<Memory>
  delete(ids: string[]): Promise<void>

  // Query
  search(query: string, opts?: SearchOpts): Promise<SearchResult[]>
  list(opts?: ListOpts): Promise<Memory[]>

  // Meta
  tags(): Promise<TagCount[]>
  stats(): Promise<SourceStats>

  // Index management
  index(onProgress?: (done: number, total: number) => void): Promise<number>
  indexRebuild(onProgress?: (done: number, total: number) => void): Promise<number>
  indexStatus(): Promise<IndexStatus>

  // Source-provided runnable commands
  commands(): SourceCommandMeta[]
  run(command: string, ctx?: RunContext): Promise<unknown>
}

interface AddInput {
  content: string
  digest?: string           // defaults to content
  tags?: string[]
  metadata: Record<string, string>  // from source config, auto-injected by CLI
}

interface UpdateInput {
  content?: string
  digest?: string
  tags?: string[]
  metadata: Record<string, string>
}

interface SearchOpts {
  tags?: string[]
  after?: string
  before?: string
  limit?: number            // default 10
  metadata: Record<string, string>
}

interface ListOpts {
  tags?: string[]
  after?: string
  before?: string
  limit?: number            // default 10
  offset?: number
  sort?: 'time' | 'access'  // default 'time'
  metadata: Record<string, string>
}

interface SearchResult {
  id: string
  digest: string
  tags: string[]
  score: number
  createdAt: string
}

interface TagCount {
  tag: string
  count: number
}

interface SourceStats {
  totalMemories: number
  totalTags: number
  storageSize?: number
  indexStatus?: {
    indexed: number
    total: number
    model?: string
  }
}
```

The CLI routes commands to the appropriate source. When multiple sources are active, `search` queries all sources, merges results by score, and deduplicates. Use `--source <name>` to target a specific source.

## Search Pipeline (SQLite Source Implementation)

```
agmem search <query>
  │
  ├── FTS5 keyword search (always on)
  │   → exact matches, fast
  │
  ├── Vector similarity search (when embeddings available)
  │   → semantic matches
  │
  └── RRF Fusion
      score = Σ 1/(k + rank_i)    k=60
      → merged, deduplicated, sorted
      → return digest + score + tags
```

No query preprocessing or HyDE needed — the primary user is an AI agent, which naturally formulates high-quality queries. Guidance in skill instructions is sufficient.

## Embedding Strategy (SQLite Source Implementation)

**What to embed:**

Contextual embedding text, not raw content:

```
[tag1, tag2] content
```

Tags provide context that improves embedding quality (Anthropic Contextual Retrieval approach). Stored content is unchanged; embedding text is constructed at indexing time.

**When to embed:**

- `agmem add` / `agmem update` → embedding generated automatically (sync, on write)
- First call lazy-loads the embedding model (~seconds), subsequent calls ~50ms per memory
- Embedding failure is silent — does not block the write operation
- `agmem run embed` available for batch catch-up of any un-indexed memories
- Unembedded memories fall back to FTS-only search (transparent)

**Default model:** `nomic-embed-text` (768 dims, local, quality comparable to OpenAI text-embedding-3-small)

**Model switching:**
1. Generate new embeddings into `memories_vec_new` temp table
2. On success: `BEGIN; DROP memories_vec; RENAME memories_vec_new → memories_vec; UPDATE meta; COMMIT;`
3. On failure: nothing changes, old index intact

**Source abstraction:** Configurable via `config`. Supports local (nomic, etc.) and remote (OpenAI, Gemini, etc.) with auto-fallback chain.

## Output Formats

```bash
# Default: TOON (compact, LLM-optimized, ~40% fewer tokens than JSON)
agmem search "ESM"
results[2]{id,score,tags,digest}:
 a3f2,0.87,node|esm,Node 22 ESM path resolution bug in monorepo
 b7e1,0.72,node|esm,ESM and CommonJS __dirname interop issue

# --json: standard JSON (for machine parsing)
agmem search "ESM" --json
[{"id":"a3f2","tags":["node","esm"],"score":0.87,"digest":"..."},...]

# --human: human-readable (for terminal use)
agmem search "ESM" --human
# a3f2  [node, esm]  Node 22 ESM path resolution bug in monorepo   0.87
# b7e1  [node, esm]  ESM and CommonJS __dirname interop issue       0.72
```

## MVP Scope

MVP uses local SQLite source only. Architecture supports multiple and remote sources but implementation is deferred.

**MVP:**
- Source interface + local SQLite source (FTS5 + sqlite-vec)
- Embedding support (nomic-embed-text default, hybrid search with RRF)
- Commands: add / get / update / delete / search / list / tags / stats
- Source commands via `run`: init / status / embed / embed-rebuild / embed-status
- Config: config set / get / list / delete (global + --source)
- Source management: source list
- Output formats: TOON (default) / JSON / human

**P1:**
- Remote sources (GitHub Gist, S3)
- `agmem source add / remove / sync`

**P2:**
- Memory extraction (extract from session text)
- Relations table + `--related` flag on get

**P3:**
- Memory lifecycle (relevance decay, auto-summarization, archival)
