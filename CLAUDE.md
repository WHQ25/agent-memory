# CLAUDE.md

## Project Overview

**agent-memory** — Long-term, cross-project memory system for AI agents. Monorepo with two npm packages:

- `@agent-memory/core` — Interfaces, SQLite source, hybrid search (FTS + vector + RRF), embedding, config
- `@agent-memory/cli` — CLI tool (`agmem`) with JSON/human/TOON output formats

## Quick Reference

```bash
bun install          # Install all dependencies
bun run build        # Build all packages (tsc -b with project references)
bun run test         # Run all tests (vitest)
bun run test:watch   # Watch mode
```

## Architecture

```
packages/core/src/
├── source/interface.ts          # MemorySource interface (all CRUD + search + index)
├── source/sqlite/index.ts       # SqliteSource: better-sqlite3 + WAL mode
├── search/pipeline.ts           # Hybrid search: FTS → vector → RRF fusion (k=60)
├── search/rrf.ts                # Reciprocal Rank Fusion
├── embedding/transformers.ts    # Hugging Face Transformers embedding provider
└── config/paths.ts              # env-paths for cross-platform directories

packages/cli/src/
├── index.ts                     # Entry point (#!/usr/bin/env node)
├── cli/commands/                # One file per command (add, get, search, list, etc.)
├── cli/middleware.ts            # resolveSource(), closeSource(), readStdin()
└── format/                      # JSON, human-readable, TOON formatters
```

### Key Design Patterns

- **Graceful degradation**: sqlite-vec unavailable → FTS-only search; embedding failure → doesn't block writes
- **Deduplication**: Content SHA-256 hash checked in a transaction before insert
- **Access tracking**: `accessCount` incremented on every `get()`
- **Output formats**: `--json` (machine), `--human` (terminal), default TOON (LLM-optimized, ~40% fewer tokens)

## Code Conventions

- **ESM-only** (`"type": "module"`), all imports use `.js` extension
- **File naming**: kebab-case (`embedding-sync.ts`)
- **DB columns**: snake_case (`access_count`, `created_at`)
- **TypeScript**: strict mode, `import type` for type-only imports
- **CLI commands**: each in its own file, registered via `registerXxxCommand(program)`

## Build System

- **Root `tsconfig.json`**: project references only (`packages/core`, `packages/cli`)
- **`tsconfig.base.json`**: shared compiler options (ES2022, NodeNext, strict)
- **Per-package**: `composite: true`, `outDir: ./dist`, `rootDir: ./src`
- **Build command**: `tsc -b` (not `npm run build --workspaces` — causes infinite loop with bun)

## Testing

- **Framework**: Vitest with globals enabled
- **Alias**: `@agent-memory/core` → `packages/core/src/index.ts` (in vitest.config.ts)
- **Tests location**: `tests/` at root (source, search, format, CLI e2e)
- **SQLite tests**: use `:memory:` databases, `beforeEach`/`afterEach` for setup/teardown
- **CLI e2e**: spawns `node packages/cli/dist/index.js` with isolated XDG dirs in temp folder

## Publishing

- **Workflow**: `.github/workflows/publish.yml` triggers on `v*` tags
- **OIDC**: npm trusted publishing with `--provenance` (requires Node 24 / npm >= 11.5.1)
- **No NPM_TOKEN needed**: uses GitHub OIDC id-token
- **CLI depends on core**: `"@agent-memory/core": "^0.1.0"` (not `workspace:*` — npm doesn't resolve it)
- **Bun resolves** `^0.1.0` to local workspace during development

## Version Bumping

When releasing: update version in both `packages/core/package.json`, `packages/cli/package.json`, and the CLI's `program.version()` in `packages/cli/src/index.ts`. The e2e test checks `--version` output.
