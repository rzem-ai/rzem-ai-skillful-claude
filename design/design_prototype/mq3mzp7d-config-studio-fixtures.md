# Config Studio - Design Fixture Set

Sample configuration data for designing Config Studio. Every screen should be mocked against this one fixture, not placeholder data. It is deliberately engineered: every scenario the UI must handle - shadowing, array merges, an unbeatable deny, an ignored setting, a wrong-file key, an unresolved variable, a name collision, a broken file, a secret, and a missing import - appears exactly once.

**Fixture project**: `config-studio`, located at `~/Projects/config-studio`, a git repo. Current user: `alex`.

---

## Part A - The files

### A1. Managed settings (file-based, Linux/WSL path shown; read-only)

`/etc/claude-code/managed-settings.json` - valid, last modified 2026-05-12:

```json
{
  "permissions": {
    "deny": ["Bash(curl *)", "Read(//etc/secrets/**)"]
  },
  "disableBypassPermissionsMode": "disable",
  "forceLoginMethod": "claudeai",
  "sandbox": {
    "network": {
      "deniedDomains": ["uploads.github.com"]
    }
  }
}
```

`/etc/claude-code/managed-settings.d/20-experimental.json` - **INVALID JSON** (trailing comma, line 4). Demonstrates: red health badge inside the managed scope card, parse error detail with line number, file excluded from resolution.

```json
{
  "spinnerTipsEnabled": false,
  "autoUpdatesChannel": "stable",
}
```

Delivery channel for the managed tier in this fixture: **file** (badge shows "Enforced via file").

### A2. User settings

`~/.claude/settings.json` - valid with **one semantic warning**, last modified 2026-06-02:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "model": "claude-opus-4-7",
  "effortLevel": "high",
  "alwaysThinkingEnabled": true,
  "editorMode": "vim",
  "autoConnectIde": true,
  "permissions": {
    "defaultMode": "plan",
    "allow": ["Bash(git diff *)", "Bash(git log *)"],
    "deny": ["Read(~/.ssh/**)"]
  },
  "env": {
    "NODE_ENV": "development",
    "NPM_TOKEN": "npm_4xK9fT2mQ8vLpR3sW7yB1nC5dH6jZ0aE"
  }
}
```

Demonstrates:
- `autoConnectIde` is a **wrong-file key** (belongs in `~/.claude.json`) → amber lint: "This key is ignored here - it belongs in ~/.claude.json. [Move it]"
- `NPM_TOKEN` matches a token pattern → **masked by default** (`npm_••••••••`, per-field reveal control)
- `model` and `defaultMode` will both be shadowed by project settings (see Part B)

### A3. Project settings

`~/Projects/config-studio/.claude/settings.json` - valid, committed, last modified 2026-06-05:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "model": "claude-sonnet-4-6",
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": ["Bash(npm run *)", "Bash(curl localhost*)"],
    "ask": ["Bash(git push *)"],
    "deny": ["Read(./.env)", "Read(./.env.*)"],
    "additionalDirectories": ["../config-studio-docs/"]
  },
  "enabledPlugins": {
    "formatter@team-tools": true
  },
  "extraKnownMarketplaces": {
    "team-tools": {
      "source": { "source": "github", "repo": "rzem/claude-plugins" }
    }
  }
}
```

Demonstrates:
- `model` **shadows** user's `claude-opus-4-7` (ordinary scalar override)
- `Bash(curl localhost*)` allow can **never win** against the managed `Bash(curl *)` deny → amber lint on the rule: "Unreachable - always matched first by a managed deny rule"
- Array merge sources for the merged permission list

### A4. Local settings

`~/Projects/config-studio/.claude/settings.local.json` - valid, gitignored, last modified 2026-06-06:

```json
{
  "permissions": {
    "defaultMode": "auto"
  },
  "outputStyle": "Explanatory",
  "enabledPlugins": {
    "formatter@team-tools": false
  }
}
```

Demonstrates:
- `defaultMode: "auto"` is **ignored by rule** (not honoured from project/local scope since v2.1.142) → distinct "ignored" treatment, *not* ordinary shadowing: "Ignored - auto mode can only be set in user settings. [Move to user settings]"
- `outputStyle` wins over nothing (only defined here) → Local chip, no shadow indicator
- Plugin opt-out: local `false` beats project `true` → Extensions view shows formatter disabled with "overridden locally" caption

### A5. Global state file

`~/.claude.json` (excerpt - OAuth/cache sections folded in the Raw Editor):

```json
{
  "oauthAccount": { "…": "folded - read-only by default" },
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp",
      "headers": { "Authorization": "Bearer ${GITHUB_PAT}" }
    }
  },
  "projects": {
    "/home/alex/Projects/config-studio": {
      "mcpServers": {
        "scratch-db": {
          "type": "stdio",
          "command": "npx",
          "args": ["@modelcontextprotocol/server-postgres", "postgresql://localhost/scratch"]
        }
      },
      "hasTrustDialogAccepted": true
    }
  }
}
```

Demonstrates: user-scope `github` server (collision with A6), local-scope `scratch-db` keyed by project path, folded sensitive sections.

### A6. Project MCP

`~/Projects/config-studio/.mcp.json` - valid, committed:

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp"
    },
    "sentry": {
      "type": "http",
      "url": "https://mcp.sentry.dev/mcp",
      "headers": { "Authorization": "Bearer ${SENTRY_AUTH_TOKEN}" }
    },
    "docs-search": {
      "type": "http",
      "url": "${DOCS_API_BASE:-https://docs.internal.rzem.dev}/mcp"
    }
  }
}
```

Demonstrates:
- `github` **name collision**: project beats user (Local > Project > User; no local `github` exists) → MCP map shows stacked cards, project on top, user card greyed with "shadowed"
- `${SENTRY_AUTH_TOKEN}` is **unset** in the current environment and has no default → amber "unresolved variable" state on the sentry card
- `${DOCS_API_BASE:-…}` has a default → resolved state, hover shows expansion

### A7. Memory files

```text
~/.claude/CLAUDE.md                                  # exists, 14 lines, loads always
~/Projects/config-studio/CLAUDE.md                   # exists, see imports below
~/Projects/config-studio/CLAUDE.local.md             # exists, gitignored badge
~/Projects/config-studio/engine/CLAUDE.md            # exists, BELOW cwd → "lazy-load" marker
```

`~/Projects/config-studio/CLAUDE.md` contains:

```markdown
# Config Studio

Engine is pure logic - no UI imports allowed in engine/.

@docs/git-workflow.md
@docs/style-guide.md
```

- `docs/git-workflow.md` exists (import depth 1, resolves)
- `docs/style-guide.md` **does not exist** → broken-link flag in the Memory Map import graph

Auto memory: `~/.claude/projects/-home-alex-Projects-config-studio/memory/MEMORY.md` exists (6 entries), auto memory **enabled**.

### A8. Extensions

```text
~/.claude/agents/code-reviewer.md          # user subagent, frontmatter: name, description, tools: [Read, Grep]
~/Projects/config-studio/.claude/skills/release-notes/SKILL.md   # project skill
~/Projects/config-studio/.claude/commands/changelog.md           # project slash command
```

Plus the plugin from A3/A4: `formatter@team-tools` (project-enabled, locally disabled).

---

## Part B - Ground truth: the expected effective configuration

This is what the Visualise workspace must render. If a design shows anything different, the design is wrong.

### B1. Resolved scalar keys

| Key | Effective value | Winning scope (chip) | Shadowed / notes |
|---|---|---|---|
| `model` | `claude-sonnet-4-6` | Project | User `claude-opus-4-7` shadowed |
| `permissions.defaultMode` | `acceptEdits` | Project | User `plan` shadowed; Local `auto` **ignored by rule** (distinct treatment) |
| `outputStyle` | `Explanatory` | Local | - |
| `effortLevel` | `high` | User | - |
| `alwaysThinkingEnabled` | `true` | User | - |
| `editorMode` | `vim` | User | - |
| `forceLoginMethod` | `claudeai` | Managed | Locked row |
| `disableBypassPermissionsMode` | `disable` | Managed | Locked row |
| `autoConnectIde` | - (inert) | - | Wrong-file lint on User settings |
| `spinnerTipsEnabled` | default (`true`) | - | Drop-in fragment that set it is invalid JSON → excluded |

### B2. Merged permission rules, in evaluation order

| # | Behaviour | Rule | Source chip | Notes |
|---|---|---|---|---|
| 1 | deny | `Bash(curl *)` | Managed | |
| 2 | deny | `Read(//etc/secrets/**)` | Managed | |
| 3 | deny | `Read(~/.ssh/**)` | User | |
| 4 | deny | `Read(./.env)` | Project | |
| 5 | deny | `Read(./.env.*)` | Project | |
| 6 | ask | `Bash(git push *)` | Project | |
| 7 | allow | `Bash(git diff *)` | User | |
| 8 | allow | `Bash(git log *)` | User | |
| 9 | allow | `Bash(npm run *)` | Project | |
| 10 | allow | `Bash(curl localhost*)` | Project | ⚠ unreachable - managed deny #1 always matches first |

### B3. Rule tester - example inputs and expected outcomes

| Input | Outcome banner | Match trace |
|---|---|---|
| `Bash(curl localhost:3000/health)` | **Denied** | Matched rule #1 `Bash(curl *)` (Managed). Note: project allow #10 would have matched but deny is evaluated first |
| `Bash(git push origin main)` | **Ask** | Matched rule #6 (Project) |
| `Bash(npm run test)` | **Allowed** | Matched rule #9 (Project) |
| `Read(./src/main.ts)` | **Default behaviour** | No rule matched → falls through to permission mode `acceptEdits` |

### B4. MCP server map - final state

| Server | Effective source | State |
|---|---|---|
| `github` | Project (`.mcp.json`) | Connected ✓ - user-scope definition shadowed (stacked card) |
| `sentry` | Project | ⚠ `${SENTRY_AUTH_TOKEN}` unresolved |
| `docs-search` | Project | Connected ✓ - `${DOCS_API_BASE:-…}` resolved via default |
| `scratch-db` | Local | Connected ✓ |

### B5. Scope Stack health badges

| Layer | Badge | Detail |
|---|---|---|
| Managed (file) | ⚠ amber | Base file valid; drop-in `20-experimental.json` invalid JSON at line 4 |
| Local | ✓ + ℹ | Valid; contains one ignored key |
| Project | ⚠ amber | Valid; one unreachable allow rule |
| User | ⚠ amber | Valid; one wrong-file key, one masked secret |

(A deliberately imperfect stack - every card has something to inspect.)

### B6. Memory Map

- Load order: `~/.claude/CLAUDE.md` → project `CLAUDE.md` → `CLAUDE.local.md`
- `engine/CLAUDE.md`: shown in tree with **lazy** marker ("loads when Claude reads files in engine/")
- Import graph: `CLAUDE.md → docs/git-workflow.md` ✓ (depth 1); `CLAUDE.md → docs/style-guide.md` ✗ broken link
- Auto memory card: enabled, 6 entries, path shown

---

## Part C - Scenario index

Quick lookup for designers: which fixture demonstrates which UI requirement.

| UI requirement | Fixture |
|---|---|
| Ordinary scalar shadowing | `model` (A2 vs A3) |
| Ignored-by-rule (distinct from shadowing) | `defaultMode: "auto"` in A4 |
| Array merge across scopes | Permission rules (A1 + A2 + A3) → B2 |
| Unbeatable deny lint | Rule #10 (A3 vs A1) |
| Locked managed key | `forceLoginMethod` (A1) |
| Invalid JSON / health badge | Drop-in fragment (A1) |
| Wrong-file key lint | `autoConnectIde` (A2) |
| Secret masking | `NPM_TOKEN` (A2) |
| Unresolved `${VAR}` | `sentry` (A6) |
| Resolved `${VAR:-default}` | `docs-search` (A6) |
| MCP name collision | `github` (A5 vs A6) |
| Plugin local opt-out | `formatter@team-tools` (A3 vs A4) |
| Broken @import | `style-guide.md` (A7) |
| Lazy-load memory file | `engine/CLAUDE.md` (A7) |
| Folded sensitive sections in Raw Editor | OAuth block (A5) |
| Gitignore badges | A4, `CLAUDE.local.md` (A7) |
| Hero flow ("why won't this setting die") | `defaultMode` end to end: B1 row 2 → A2/A3/A4 side-by-side |
