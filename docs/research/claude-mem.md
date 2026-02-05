# claude-mem Research

> Claude Code memory plugin. NPM: `claude-mem`
> Repo: https://github.com/thedotmack/claude-mem

## Overview

Claude Code-specific memory plugin that **automatically extracts** structured observations from agent sessions via hooks. Runs as an independent worker process with HTTP API, stores to SQLite + ChromaDB, and exposes search tools via MCP Server.

## Architecture

```
Claude Code Session
  → Hooks (SessionStart / UserPromptSubmit / PostToolUse / Stop)
  → Worker Service (Express HTTP :37777)
  → SQLite (~/.claude-mem/claude-mem.db)
  → ChromaDB (~/.claude-mem/vector-db) [optional]
  → MCP Server (search tools exposed to Claude)
```

### Tech Stack

- Runtime: Node.js 18+ / Bun
- Language: TypeScript → ESM
- Database: SQLite 3 (WAL mode, bun:sqlite)
- Vector: ChromaDB via MCP (Python backend)
- Web UI: React 18 + Express.js
- Agent: Claude Agent SDK (for observation parsing)
- Package: npm + Bun + uv (Python)

## Data Model

### Core Tables

**sdk_sessions** — Session tracking

| Field | Description |
|-------|-------------|
| content_session_id | Claude's session ID |
| memory_session_id | Internal ID |
| project | Project name |
| user_prompt | Initial prompt |
| status | active / completed / failed |
| prompt_counter | Total prompts in session |

**observations** — Structured memory units (core)

| Field | Description |
|-------|-------------|
| type | decision / bugfix / feature / refactor / discovery / change |
| title | Observation headline |
| subtitle | Secondary context |
| facts | JSON array — key findings |
| narrative | Detailed explanation |
| concepts | JSON array — knowledge domain tags |
| files_read | JSON array |
| files_modified | JSON array |
| prompt_number | Which prompt generated this |
| discovery_tokens | Token cost tracking |

**session_summaries** — Session-level compression

| Field | Description |
|-------|-------------|
| request | What was asked |
| investigated | What was explored |
| learned | Key learnings |
| completed | What was done |
| next_steps | Follow-up actions |
| notes | Additional notes |

**user_prompts** — User input tracking (synced to Chroma for semantic search)

### Additional

- `schema_versions` — Migration tracking
- `pending_messages` — Queue for failed observations
- FTS5 virtual tables (deprecated, kept for backward compatibility)

## Memory Lifecycle

### Creation (Automatic Extraction)

1. `PostToolUse` hook fires after tool execution
2. Captures tool name, input, output, CWD
3. Strips `<private>` tags (privacy protection)
4. Sends to Worker → SDKAgent parses `<observation>` XML blocks
5. Validates observation type against active mode config
6. Stores to SQLite + syncs to ChromaDB

### Context Injection (Recall)

1. `SessionStart` hook → `/api/context/inject`
2. ContextBuilder coordinates:
   - Load config → query observations → calculate tokens → build timeline → render sections
3. Token-aware: stops injection when approaching budget limit

### No Explicit Expiration

- Observations are **immutable** (no update operations)
- No TTL mechanism
- Duplicate cleanup utility available

## Search Architecture

### 3-Layer Progressive Disclosure

```
Layer 1: /api/search       → Compact index (~50-100 tokens): IDs, titles, types, dates
Layer 2: /api/timeline     → Context window (~200-300 tokens): observations before/after anchor
Layer 3: /api/get_observations → Full details (~500-1000 tokens per result)
```

Agent requests progressively more detail as needed — saves tokens.

### Search Strategies

| Strategy | When Used |
|----------|-----------|
| Filter-Only | No query text → SQLite direct (concept, file, type, date filters) |
| Semantic | Query + Chroma available → vector search |
| Hybrid | Metadata filter + semantic ranking, intersection |
| Fallback | Chroma unavailable → SQLite FTS5 |

### ChromaDB Sync

- Real-time: sync on observation/summary/prompt creation
- Backfill: smart sync detecting missing IDs
- Batch: 100 docs per batch
- Granularity: each field (narrative, text, facts, etc.) becomes a separate vector document
- **Windows: Chroma disabled** (prevents console popup spawning)

## Agent Integration

### Hooks (5 lifecycle points)

| Hook | Action |
|------|--------|
| SessionStart | Install, start worker, inject context |
| UserPromptSubmit | Initialize session, store user prompt |
| PostToolUse | Capture observation |
| Stop | Generate session summary |

### MCP Server

Exposes 2 tools to Claude:
1. `search` — Query memory index
2. `timeline` — Contextual window around results

### AI Agent Backends (fallback chain)

1. **SDKAgent** (primary) — Claude Agent SDK, parses `<observation>` XML
2. **GeminiAgent** (fallback) — Google Gemini
3. **OpenRouterAgent** (fallback) — Multi-model routing

### Mode System

Plugin-like configuration (`/plugin/modes/*.json`):
- Defines valid observation types
- System prompts for each agent
- Output format examples
- Per-locale variants (code--chill, code--fr, code--ar)

## Notable Design Decisions

### Strengths

- **Automatic extraction** — No manual effort, hooks capture everything
- **Progressive disclosure** — 3-layer API saves tokens significantly
- **Discovery tokens tracking** — Quantifies memory ROI
- **Privacy edge processing** — `<private>` tags stripped before storage
- **Structured observations** — Rich data model (type, facts, concepts, files)
- **Graceful degradation** — Chroma down → SQLite fallback, agent down → try next agent

### Weaknesses

- **Heavy dependencies** — ChromaDB needs Python + uv, complex install chain
- **Tightly coupled to Claude Code** — Hooks, MCP, session model all Claude-specific
- **No provider abstraction** — Storage backend hardcoded (SQLite + Chroma)
- **No remote sync** — Local only, no cross-device sharing
- **No memory decay** — Only grows, never prunes
- **Immutable observations** — Can't correct mistakes, only add new ones
- **Worker process overhead** — Separate HTTP server on :37777

## Key Takeaways for agmem

| What to Borrow | Why |
|----------------|-----|
| Progressive disclosure API design | Token-efficient recall |
| Discovery tokens / ROI tracking | Measure memory value |
| `<private>` tag stripping | Privacy protection pattern |
| Structured observation model (type, facts, concepts) | Rich metadata enables better filtering |
| Mode system for customization | Extensible behavior per context |

| What to Avoid | Why |
|---------------|-----|
| ChromaDB dependency | Too heavy, prefer sqlite-vec or in-process |
| Tight agent coupling | agmem must be agent-agnostic |
| Separate worker process | Keep it simple, in-process or single CLI |
| No expiration mechanism | Need memory decay for long-term health |
