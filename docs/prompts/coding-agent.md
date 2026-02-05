# Agent Memory — Coding Agent Prompt

You have access to `agmem`, a long-term memory tool that persists knowledge across sessions and projects. Use it to avoid repeating mistakes, recall proven solutions, and accumulate expertise over time.

**Default output is TOON format (LLM-optimized). Use `--json` only when piping to other tools.**

## Commands Quick Reference

```bash
agmem search "<query>" [--tags t1,t2] [--limit n]  # Find relevant memories
agmem get <id>                                       # Get full content
agmem add "<content>" --tags t1,t2 --digest "<summary>"  # Store new memory
agmem update <id> --tags t1,t2                       # Update existing
agmem delete <id>                                    # Remove outdated memory
agmem tags                                           # See all tags in use
agmem list --tags <tag> --sort access                # Browse by tag/frequency
```

Long content: `echo "..." | agmem add --tags t1 --digest "summary"`

---

## When to Store Memories

Store a memory when you encounter knowledge worth preserving. Apply the **"would I wish I knew this earlier?"** test — if yes, store it.

### Store after these triggers:

**Bug Resolution**
After fixing a non-trivial bug, record the root cause and the fix. Especially valuable when the symptoms were misleading or the root cause was non-obvious.

**Library / API Quirks**
When a library behaves in an undocumented or counter-intuitive way. If you had to read source code or experiment to figure it out, future-you will benefit from a note.

**Architecture & Design Decisions**
When a meaningful technical choice is made (and why), especially when alternatives were considered and rejected. The reasoning is often more valuable than the decision itself.

**Project Constraints**
Hard constraints that aren't captured in config or linting rules — e.g., "cannot use CommonJS in this monorepo", "DB has no foreign key support", "CI timeout is 10 minutes".

**Environment & Tooling Gotchas**
Build quirks, CI/CD nuances, platform-specific behaviors, version incompatibilities. The kind of knowledge that takes 30 minutes to rediscover.

**User Corrections & Preferences**
When the user corrects your approach or expresses a preference that goes beyond standard conventions. These are signals you should not need to relearn.

**Effective Patterns**
When you discover or apply a pattern that works particularly well in the current codebase. Not generic best practices — project-specific idioms.

### Do NOT store:

- Generic knowledge you already know (e.g., "use `Array.map` for transformations")
- Trivial one-off facts unlikely to recur
- Information already captured in project docs, CLAUDE.md, or config files
- Sensitive data (credentials, tokens, personal information)

---

## How to Organize Memories

### Tags

Use **2–4 tags** per memory. Combine a **type tag** with one or more **topic tags**.

**Type tags** (pick one):
| Tag | Use for |
|-----|---------|
| `bug` | Bug root causes and fixes |
| `quirk` | Undocumented or surprising behavior |
| `decision` | Architecture/design choices with rationale |
| `constraint` | Hard limits, invariants, rules |
| `pattern` | Reusable code patterns and idioms |
| `preference` | User or team preferences |
| `tooling` | Build, CI/CD, dev environment knowledge |
| `todo` | Incomplete work, deferred tasks |

**Topic tags**: Use the relevant technology, library, or domain name — e.g., `node`, `react`, `sqlite`, `auth`, `monorepo`, `testing`. Keep them lowercase, singular, and consistent.

**Project tags**: When working across multiple projects, add a project identifier tag — e.g., `myapp`, `api-gateway`.

Check `agmem tags` before inventing new tags to stay consistent with existing ones.

### Digest

The digest is a **one-line summary** (under 80 chars) shown in search results. Write it as a concise statement of the core insight:

- Good: `"bun workspace: tsc -b required, not npm run build --workspaces"`
- Good: `"sqlite-vec missing: search falls back to FTS-only gracefully"`
- Bad: `"bug fix"` (too vague)
- Bad: `"I found that when using bun with workspaces..."` (too wordy, don't narrate)

### Content Structure

Keep memories **atomic** — one insight per memory. Structure content as:

```
[What] The core fact, behavior, or solution.
[Why] Context: when this matters, what triggers it, why it happens.
[How] Code snippet, command, or concrete steps (if applicable).
```

Example:
```
bun does not support `npm run build --workspaces` — it causes an infinite loop
when composite TypeScript project references are used.

Use `tsc -b` directly at the repo root instead. This correctly follows project
references and builds in dependency order.

// package.json
"scripts": { "build": "tsc -b" }
```

---

## When to Retrieve Memories

### Retrieve at these moments:

**Starting a new task**
Before diving into implementation, search for relevant memories. A 5-second search can save minutes of re-discovery.
```bash
agmem search "relevant keywords for the task"
```

**Encountering an error**
Before debugging from scratch, check if you've seen this error before.
```bash
agmem search "the error message or symptom" --tags bug
```

**Making a technical decision**
Before proposing an approach, check for prior decisions or constraints in the same area.
```bash
agmem search "topic area" --tags decision,constraint
```

**Working with a specific library or tool**
Check for known quirks before using assumptions.
```bash
agmem search "library-name" --tags quirk
```

**Returning to a project after a gap**
Browse recent memories to rebuild context.
```bash
agmem list --tags project-name --sort time --limit 20
```

**Before suggesting preferences-sensitive changes**
Check if the user has expressed preferences on this topic.
```bash
agmem search "topic" --tags preference
```

### Retrieval Workflow

1. **Search first** — `agmem search` returns digests (not full content) to save tokens
2. **Get selectively** — use `agmem get <id>` only for memories that look relevant
3. **Don't over-retrieve** — if search returns nothing useful, move on; don't dig through the entire memory store

---

## Memory Lifecycle

- **Update** memories when you discover new information about the same topic: `agmem update <id> --content "refined insight"`
- **Delete** memories that turn out to be wrong or are no longer relevant: `agmem delete <id>`
- **Don't duplicate** — if a search reveals an existing memory on the same topic, update it rather than creating a new one. The tool deduplicates identical content, but semantically similar memories should be merged manually.
