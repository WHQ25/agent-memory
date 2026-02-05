# @agent-memory/cli

CLI for [agent-memory](https://github.com/WHQ25/agent-memory) — long-term, cross-project memory for AI agents.

## Install

```bash
npm install -g @agent-memory/cli
```

## Quick Start

```bash
# Initialize (downloads local embedding model)
agmem run init

# Store a memory
agmem add "Node 22 ESM has path resolution bug in monorepo" --tags node,esm

# Search (hybrid: keyword + semantic)
agmem search "ESM compatibility"

# Get full content by ID
agmem get <id>
```

## Commands

### Memory CRUD

```bash
agmem add <content> [--tags t1,t2] [--digest "summary"]
agmem get <id> [--full]
agmem update <id> [--content text] [--tags t1,t2] [--digest text]
agmem delete <id> [<id>...]

# Pipe from stdin
echo "long content" | agmem add --tags lesson
```

### Search & Browse

```bash
agmem search <query> [--tags t1,t2] [--limit n] [--after date] [--before date]
agmem list [--tags t1,t2] [--sort time|access] [--limit n] [--offset n]
agmem tags
agmem stats
```

Search returns `digest` (not full content) — use `agmem get <id>` for full detail.

### Source Commands

```bash
agmem run                  # List available commands
agmem run init             # Initialize source (download embedding model)
agmem run status           # Show source status
agmem run embed            # Batch embed un-indexed memories
agmem run embed-rebuild    # Full rebuild of all embeddings
agmem run embed-status     # Show embedding index status
```

### Config

```bash
agmem config set <key> <value> [--source name]
agmem config get <key> [--source name]
agmem config list [--source name]
agmem config delete <key> [--source name]
```

### Output Formats

| Flag | Format | Use case |
|------|--------|----------|
| _(default)_ | TOON | LLM-optimized, ~40% fewer tokens than JSON |
| `--json` | JSON | Machine parsing |
| `--human` | Human | Terminal display |

## License

MIT
