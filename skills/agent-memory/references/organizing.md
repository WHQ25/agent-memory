# Organizing Memories

## Tags

Use **2–4 tags** per memory. Combine a **type tag** with one or more **topic tags**.

### Type Tags (pick one)

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

### Topic Tags

Use the relevant technology, library, or domain name — e.g., `node`, `react`, `sqlite`, `auth`, `monorepo`, `testing`. Keep them lowercase, singular, and consistent.

### Project Tags

When working across multiple projects, add a project identifier tag — e.g., `myapp`, `api-gateway`.

Run `agmem tags` before inventing new tags to stay consistent.

## Digest

One-line summary (under 80 chars) shown in search results. Write as a concise statement of the core insight.

**Good:**
- `"bun workspace: tsc -b required, not npm run build --workspaces"`
- `"sqlite-vec missing: search falls back to FTS-only gracefully"`

**Bad:**
- `"bug fix"` — too vague
- `"I found that when using bun with workspaces..."` — too wordy

## Content Structure

Keep memories **atomic** — one insight per memory. Structure as:

```
[What] The core fact, behavior, or solution.
[Why] Context: when this matters, what triggers it, why it happens.
[How] Code snippet, command, or concrete steps (if applicable).
```

### Example

```
bun does not support `npm run build --workspaces` — it causes an infinite loop
when composite TypeScript project references are used.

Use `tsc -b` directly at the repo root instead. This correctly follows project
references and builds in dependency order.

// package.json
"scripts": { "build": "tsc -b" }
```
