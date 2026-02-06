---
name: agent-memory
description: >
  Long-term memory for AI coding agents via `agmem` CLI. Persist cross-project
  knowledge — bug fixes, library quirks, design decisions, user preferences —
  across sessions. Use when: (1) fixing a non-trivial bug worth remembering,
  (2) discovering undocumented library/API behavior, (3) making architecture
  decisions, (4) user corrects your approach or states a preference,
  (5) starting a new task and want to check for prior knowledge,
  (6) encountering an error that might have been seen before.
---

# Agent Memory

Persist knowledge across sessions and projects with `agmem`. Avoid repeating mistakes, recall proven solutions, accumulate expertise.

Default output is TOON format (LLM-optimized). Use `--json` only when piping to other tools.

## Commands

```bash
agmem search "<query>" [--tags t1,t2] [--limit n]  # Find relevant memories
agmem get <id>                                       # Get full content
agmem add "<content>" --tags t1,t2 --digest "<one-line summary>"
agmem update <id> [--content "..."] [--tags t1,t2]  # Update existing
agmem delete <id>                                    # Remove outdated
agmem tags                                           # List all tags
agmem list --tags <tag> --sort access                # Browse by tag/frequency
```

Long content: `echo "..." | agmem add --tags t1 --digest "summary"`

## When to Store

Apply the **"would I wish I knew this earlier?"** test — if yes, store it.

**Store after:**
- Bug fix with misleading symptoms or non-obvious root cause
- Library/API behaves undocumented or counter-intuitively
- Architecture/design decision made (especially with rejected alternatives)
- Project constraint not captured in config or lint rules
- Environment/tooling gotcha (build quirks, CI nuances, version issues)
- User corrects your approach or expresses a preference
- Effective project-specific pattern discovered

**Do NOT store:**
- Generic knowledge (e.g., "use `Array.map`")
- Trivial one-off facts
- Info already in project docs, CLAUDE.md, or config
- Sensitive data (credentials, tokens)

## When to Retrieve

- **Starting a task** → `agmem search "relevant keywords"`
- **Encountering an error** → `agmem search "error message" --tags bug`
- **Making a decision** → `agmem search "topic" --tags decision,constraint`
- **Using a library** → `agmem search "library-name" --tags quirk`
- **Returning to a project** → `agmem list --tags project-name --sort time --limit 20`
- **Preferences-sensitive change** → `agmem search "topic" --tags preference`

**Workflow:** search first (digests only) → `agmem get <id>` selectively → move on if nothing useful.

## Memory Lifecycle

- **Update** when new info emerges: `agmem update <id> --content "refined insight"`
- **Delete** when wrong or obsolete: `agmem delete <id>`
- **Don't duplicate** — search first, update existing memories instead of creating new ones

## Organizing Memories

For detailed guidance on tags, digests, and content structure, see [references/organizing.md](references/organizing.md).
