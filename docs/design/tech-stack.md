# Tech Stack

Technology decisions for agent-memory MVP.

## Runtime & Build

| | Choice | Notes |
|--|--------|-------|
| Runtime | Node.js 22+ | LTS, ESM native |
| Language | TypeScript | ESM only, strict mode |
| Package manager | Bun | Fast install, compatible npm publish |
| Module system | ESM | No CommonJS |

## Dependencies

### Core

| Package | Purpose | Notes |
|---------|---------|-------|
| `commander` | CLI framework | Zero deps, 13 commands + subcommands + global flags |
| `better-sqlite3` | SQLite driver | Sync API, FTS5 built-in, `loadExtension` for sqlite-vec |
| `sqlite-vec` | Vector search | Pre-built binaries, loaded via better-sqlite3. Pre-v1 (v0.1.7-alpha.2), brute-force search, fine for <100K memories |
| `@huggingface/transformers` | Local embedding | Runs nomic-embed-text-v1.5 via ONNX, auto-downloads model (~65MB q8), zero native compilation |
| `@toon-format/toon` | TOON output format | Official package, v2.1.0, zero deps, encode/decode API |
| `env-paths` | Config/data paths | Cross-platform XDG directories |
| `uuid` | Memory ID generation | UUID v4 |

### Dev

| Package | Purpose |
|---------|---------|
| `vitest` | Testing (native TS/ESM, zero config) |
| `typescript` | Type checking |
| `@types/better-sqlite3` | Type declarations |

## File Locations

Using `env-paths('agmem')` for cross-platform support:

| Type | Linux | macOS |
|------|-------|-------|
| Config | `~/.config/agmem/` | `~/Library/Preferences/agmem/` |
| Data | `~/.local/share/agmem/` | `~/Library/Application Support/agmem/` |
| Cache | `~/.cache/agmem/` | `~/Library/Caches/agmem/` |

- **Config**: `config.json` (global settings, source configs)
- **Data**: `memories.db` (SQLite database)
- **Cache**: Embedding model files (auto-downloaded by transformers.js)

## SQLite Setup

better-sqlite3 with raw SQL. No ORM — FTS5 and sqlite-vec require direct SQL, adding an ORM layer provides little value.

```typescript
import Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'

const db = new Database('memories.db')
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
sqliteVec.load(db)
```

### Schema

```sql
CREATE TABLE memories (
  id            TEXT PRIMARY KEY,
  hash          TEXT NOT NULL,
  content       TEXT NOT NULL,
  digest        TEXT NOT NULL,
  tags          TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  access_count  INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX idx_memories_hash ON memories(hash);

CREATE VIRTUAL TABLE memories_vec USING vec0(
  id TEXT PRIMARY KEY,
  embedding FLOAT[768]
);

CREATE VIRTUAL TABLE memories_fts USING fts5(
  content, tags,
  content=memories
);

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
```

## Embedding

### Model

Default: `nomic-ai/nomic-embed-text-v1.5` (768 dims, q8 quantized ~65MB)

Nomic-embed-text requires prefixes:
- Indexing: `search_document: <content>`
- Querying: `search_query: <query>`

### Integration

```typescript
import { pipeline } from '@huggingface/transformers'

const extractor = await pipeline(
  'feature-extraction',
  'nomic-ai/nomic-embed-text-v1.5',
  { dtype: 'q8' }
)

// Generate embedding
const output = await extractor('search_document: memory content here', {
  pooling: 'mean',
  normalize: true,
})
const embedding: number[] = output.tolist()[0]
```

Model is loaded once (singleton), cached locally by transformers.js. First run downloads the model; subsequent runs use cache.

### Contextual embedding text

Embedding input is enriched with tags for better retrieval quality:

```
search_document: [node, esm, monorepo] Node 22 ESM has path resolution bug...
```

Stored content is unchanged. Embedding text is constructed at indexing time.

## Output Formats

### TOON (default)

```typescript
import { encode } from '@toon-format/toon'

const output = encode(data)
```

### JSON (`--json`)

```typescript
const output = JSON.stringify(data)
```

### Human (`--human`)

Custom formatted output with aligned columns for terminal readability.

## Project Structure

```
agent-memory/
├── src/
│   ├── cli/              # Commander setup, command handlers
│   │   ├── index.ts      # Entry point, global flags
│   │   └── commands/     # One file per command group
│   ├── provider/         # Provider interface and implementations
│   │   ├── interface.ts  # MemoryProvider interface
│   │   └── sqlite/       # SQLite provider implementation
│   ├── embedding/        # Embedding abstraction
│   │   ├── interface.ts  # EmbeddingProvider interface
│   │   └── transformers.ts # transformers.js implementation
│   ├── search/           # Search pipeline (FTS + vector + RRF)
│   ├── format/           # Output formatters (TOON, JSON, human)
│   └── config/           # Config management, env-paths
├── tests/
├── docs/
│   ├── design/
│   └── research/
├── package.json
├── tsconfig.json
└── README.md
```

## Known Risks

| Risk | Mitigation |
|------|------------|
| sqlite-vec is pre-v1 | Core functionality works, pin version, monitor releases |
| sqlite-vec macOS arm64 dylib issues | Known issue, workaround available |
| transformers.js first-run model download (~65MB) | Show progress, cache after first download |
| better-sqlite3 native compilation on install | Pre-built binaries available for most platforms via `prebuild-install` |
