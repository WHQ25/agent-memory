# @agent-memory/mcp

MCP server for [agent-memory](https://github.com/WHQ25/agent-memory) — long-term, cross-project memory for AI agents.

For AI agents that don't have shell access (e.g. Claude Desktop, Windsurf, Cline), this package exposes agent-memory as an [MCP](https://modelcontextprotocol.io/) server over stdio.

## Install

```bash
npm install -g @agent-memory/mcp
```

## Setup

Add to your MCP client config:

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agent-memory": {
      "command": "agmem-mcp"
    }
  }
}
```

**Claude Code** (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "agent-memory": {
      "command": "agmem-mcp"
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "agent-memory": {
      "command": "agmem-mcp"
    }
  }
}
```

## Tools

14 tools organized in 4 groups:

### Memory CRUD

| Tool | Description |
|------|-------------|
| `memory_add` | Store a new memory with optional tags and digest |
| `memory_get` | Retrieve one or more memories by ID |
| `memory_update` | Update a memory's content, tags, or digest |
| `memory_delete` | Permanently delete memories by ID |

### Search & Browse

| Tool | Description |
|------|-------------|
| `memory_search` | Hybrid search (full-text + vector + RRF fusion) |
| `memory_list` | Browse and filter memories with pagination |
| `memory_tags` | List all tags with usage counts |
| `memory_stats` | Show memory store statistics |

### Source Management

| Tool | Description |
|------|-------------|
| `source_list` | List configured memory sources |
| `source_run` | Run source commands (embed, rebuild, status) |

### Config

| Tool | Description |
|------|-------------|
| `config_set` | Set a configuration value |
| `config_get` | Get a configuration value |
| `config_list` | List all configuration values |
| `config_delete` | Delete a configuration value |

## First Run

On first use, initialize the embedding model for semantic search:

```
memory_add → works immediately (FTS search available)
source_run { command: "init" } → downloads embedding model (~65MB) for vector search
```

Without initialization, search falls back to keyword-only (FTS5). Semantic search activates once the model is downloaded.

## License

MIT
