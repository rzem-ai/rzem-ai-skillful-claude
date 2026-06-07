# Claude Code Configuration Guide

A reference for every configuration file Claude Code reads, where each one lives, what it controls, and how they interact. Current as of June 2026 (Claude Code 2.1.x). Official docs now live at https://code.claude.com/docs/en/settings.

---

## 1. The mental model: scopes and precedence

Claude Code resolves configuration through a scope hierarchy. Highest to lowest:

1. **Managed** - deployed by IT (server-managed, MDM/registry, or system `managed-settings.json`). Cannot be overridden by anything, including CLI flags.
2. **Command line arguments** - session-only overrides (`--settings`, `--model`, `--permission-mode`)
3. **Local** - `.claude/settings.local.json` (gitignored, per-machine)
4. **Project** - `.claude/settings.json` (committed, team-shared)
5. **User** - `~/.claude/settings.json` (personal, all projects)

Two merge behaviours matter:

- **Scalars override**: higher scope wins (e.g. `model` in project settings beats user settings)
- **Arrays merge**: permission rules, sandbox path lists, and similar array-valued settings are concatenated and deduplicated across all scopes, not replaced

Run `/status` inside a session to see which settings sources actually loaded (the `Setting sources` line), including the managed delivery channel. Run `/config` for the interactive settings editor. Settings files are watched and hot-reloaded - most keys apply mid-session without a restart, except `model` (use `/model`) and `outputStyle` (rebuilt on `/clear` or restart).

---

## 2. settings.json - the primary config files

The official mechanism for configuring Claude Code. Same JSON format at every scope.

| File | Scope | Shared? |
|---|---|---|
| `~/.claude/settings.json` | User (all projects) | No |
| `.claude/settings.json` | Project (repo root) | Yes - commit to git |
| `.claude/settings.local.json` | Local (this machine, this repo) | No - auto-gitignored |
| `managed-settings.json` | Managed (see §8) | Deployed by IT |

Add the schema line for editor autocomplete and validation:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json"
}
```

### Settings worth knowing (the working set)

There are 80+ keys; these are the ones you'll actually touch.

**Permissions**

```json
{
  "permissions": {
    "allow": ["Bash(npm run *)", "Bash(git diff *)"],
    "ask": ["Bash(git push *)"],
    "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)", "Bash(curl *)"],
    "additionalDirectories": ["../docs/"],
    "defaultMode": "acceptEdits"
  }
}
```

Rules follow `Tool` or `Tool(specifier)` format. Evaluation order: deny → ask → allow, first match wins. `deny` + `Read(...)` patterns is the supported way to keep secrets files out of Claude's reach (the old `ignorePatterns` is deprecated). Note: as of v2.1.142, `defaultMode: "auto"` is ignored in project/local settings so a cloned repo can't grant itself auto mode - set it in user settings.

**Environment and model**

```json
{
  "env": { "NODE_ENV": "development" },
  "model": "claude-sonnet-4-6",
  "effortLevel": "high",
  "alwaysThinkingEnabled": true,
  "language": "english"
}
```

`env` injects variables into every session and all subprocesses - use it instead of wrapper scripts. There are 200+ recognised env vars (e.g. `CLAUDE_CODE_DISABLE_AUTO_MEMORY`, `DISABLE_AUTOUPDATER`).

**Hooks** - lifecycle commands (PreToolUse, PostToolUse, ConfigChange, etc.) are configured under the `hooks` key in settings.json, not in a separate file. Related controls: `disableAllHooks`, `allowedHttpHookUrls` (URL allowlist for HTTP hooks), `httpHookAllowedEnvVars`.

**Quality of life**

| Key | What it does |
|---|---|
| `statusLine` | Custom status line script |
| `outputStyle` | System prompt style (e.g. "Explanatory") |
| `attribution` | Customise/remove the Co-Authored-By trailer and PR byline (replaces deprecated `includeCoAuthoredBy`) |
| `autoUpdatesChannel` | `"stable"` or `"latest"` |
| `cleanupPeriodDays` | Session transcript retention (default 30) |
| `plansDirectory` | Where plan-mode files land (default `~/.claude/plans`) |
| `editorMode` | `"vim"` if you're so inclined |
| `claudeMdExcludes` | Glob patterns of CLAUDE.md files to skip loading |
| `skillOverrides` | Hide/collapse skills without editing their SKILL.md |
| `apiKeyHelper` | Script that generates auth tokens dynamically |

**Sandbox** - the `sandbox` object controls OS-level bash isolation: `enabled`, `filesystem.allowWrite/denyWrite/denyRead/allowRead`, `network.allowedDomains/deniedDomains`, `excludedCommands`. Sandbox filesystem paths merge with `Edit`/`Read` permission rules. Path prefixes: `/` absolute, `~/` home, `./` project-relative (project settings) or `~/.claude`-relative (user settings).

**Worktrees** - `worktree.baseRef` (`"fresh"` or `"head"`), `worktree.symlinkDirectories` (e.g. `["node_modules"]`), `worktree.sparsePaths`. To copy gitignored files like `.env` into new worktrees, use a `.worktreeinclude` file at the project root.

**Plugins** - `enabledPlugins` (`"plugin@marketplace": true/false`) and `extraKnownMarketplaces` (declare team marketplaces in project settings; collaborators get prompted on folder trust). Project settings beat user settings here - to opt out of a project-enabled plugin, set it `false` in `settings.local.json`.

---

## 3. ~/.claude.json - global state file

Not the same thing as `~/.claude/settings.json`, despite the similar name. This file holds:

- OAuth session
- MCP server configs for **user** and **local** scopes (local entries are keyed by project path)
- Per-project state: allowed tools, trust decisions
- Various caches
- A handful of settings that live here rather than settings.json (`autoConnectIde`, `autoInstallIdeExtension`, `externalEditorContext`, `teammateDefaultModel`) - putting these in settings.json triggers a validation error

You rarely edit this by hand - `claude mcp add`, `/config`, and login flows write to it. Claude Code keeps timestamped backups of config files (five most recent) in case something goes sideways.

---

## 4. CLAUDE.md - memory files

Instructions Claude loads at session start. Delivered as a user message after the system prompt, so treat it as strong guidance, not enforced policy - for hard guarantees use permission rules or hooks.

| File | Scope |
|---|---|
| `/Library/Application Support/ClaudeCode/CLAUDE.md` (macOS) / `/etc/claude-code/CLAUDE.md` (Linux/WSL) | Managed policy |
| `~/.claude/CLAUDE.md` | User - every session, every project |
| `CLAUDE.md` or `.claude/CLAUDE.md` (project root) | Project - committed |
| `CLAUDE.local.md` | Project-local - gitignored personal notes |

Loading behaviour:

- Claude recurses **upward** from the cwd to `/`, loading every CLAUDE.md / CLAUDE.local.md it finds
- Files in subtrees **below** cwd load lazily - only when Claude reads files in those directories
- `@path/to/file` imports pull other files in (relative, absolute, or `~/` paths; max depth 5 hops; not evaluated inside code blocks)
- `/memory` shows what's loaded and lets you edit
- Managed settings can also inject org-wide instructions via the `claudeMd` settings key

**Auto memory** is the second, self-written memory system: Claude records learnings to `~/.claude/projects/<project>/memory/` (a `MEMORY.md` index plus topic files). Per-repo, machine-local, not synced or shared. Toggle with `autoMemoryEnabled`, `/memory`, or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. Relocate with `autoMemoryDirectory`.

---

## 5. MCP server configuration

Three user-facing scopes plus a managed tier:

| Scope | File | Behaviour |
|---|---|---|
| Local (default) | `~/.claude.json`, keyed by project path | This project only, private to you |
| Project | `.mcp.json` at repo root | Committed, team-shared, requires approval on first use |
| User | `~/.claude.json` | All your projects, private |
| Managed | `managed-mcp.json` (see §8) | IT-deployed; supports allowlist/denylist policy |

Name collisions resolve Local > Project > User.

`.mcp.json` format:

```json
{
  "mcpServers": {
    "my-server": {
      "type": "http",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": { "Authorization": "Bearer ${API_KEY}" }
    }
  }
}
```

Useful details:

- `${VAR}` and `${VAR:-default}` expansion works in `command`, `args`, `env`, `url`, and `headers` - so `.mcp.json` stays safe to commit while each dev supplies their own tokens
- Manage via `claude mcp add` / `add-json` / `remove` / `get`, or edit the files directly; `/mcp` in-session handles OAuth and reconnects
- Claude Code sets `CLAUDE_PROJECT_DIR` in each spawned server's environment
- Settings keys that gate project MCP: `enableAllProjectMcpServers`, `enabledMcpjsonServers`, `disabledMcpjsonServers`
- Managed controls: `allowedMcpServers`, `deniedMcpServers` (deny wins), `allowManagedMcpServersOnly`
- Config edits don't affect a running session - restart or reconnect via `/mcp`

---

## 6. Subagents, skills, commands, output styles

All markdown-with-frontmatter files, all following the same user/project split:

| Surface | User location | Project location |
|---|---|---|
| Subagents | `~/.claude/agents/*.md` | `.claude/agents/*.md` |
| Skills | `~/.claude/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` |
| Slash commands | `~/.claude/commands/*.md` | `.claude/commands/*.md` |
| Output styles | `~/.claude/output-styles/*.md` | `.claude/output-styles/*.md` |

Subagent files define a name, description, optional tool restrictions, and a system prompt in the body. The `agent` settings key can run the main thread as a named subagent.

Skills get a per-turn listing budget (`skillListingBudgetFraction`, default 1% of context) and a per-skill description cap (`maxSkillDescriptionChars`). When over budget, least-used skill descriptions collapse to bare names - `/doctor` reports truncation. Inline shell execution in skills can be disabled org-wide via `disableSkillShellExecution`.

---

## 7. Other files Claude Code reads

| File | Purpose |
|---|---|
| `.worktreeinclude` (project root) | Gitignored files to copy into new worktrees |
| `.gitignore` | Respected by the `@` file picker (toggle with `respectGitignore`) |
| `~/.claude/plans/` | Plan-mode artefacts (relocatable via `plansDirectory`) |
| `~/.claude/projects/<project>/` | Session transcripts and auto memory |

---

## 8. Managed settings (enterprise tier)

Multiple delivery mechanisms, all the same JSON shape, none overridable:

| Mechanism | Location |
|---|---|
| Server-managed | Delivered from Anthropic via the Claude.ai admin console |
| macOS MDM | `com.anthropic.claudecode` managed preferences (Jamf etc.) |
| Windows policy | `HKLM\SOFTWARE\Policies\ClaudeCode` registry (HKCU as lowest-priority fallback) |
| File-based, macOS | `/Library/Application Support/ClaudeCode/managed-settings.json` |
| File-based, Linux/WSL | `/etc/claude-code/managed-settings.json` |
| File-based, Windows | `C:\Program Files\ClaudeCode\managed-settings.json` (the old `C:\ProgramData\` path was dropped in v2.1.75) |

Within the managed tier only one source wins: server-managed > MDM/registry > file-based > HKCU. File-based supports a systemd-style drop-in directory (`managed-settings.d/*.json`, merged alphabetically over the base file) so separate teams can ship independent policy fragments. There's also `policyHelper` - an admin-deployed executable that computes managed settings dynamically at startup from device posture or identity.

Managed-only keys you'd care about from the governance side: `forceLoginMethod` / `forceLoginOrgUUID`, `disableBypassPermissionsMode`, `allowManagedPermissionRulesOnly`, `allowManagedHooksOnly`, `strictKnownMarketplaces` / `blockedMarketplaces`, `strictPluginOnlyCustomization`, `requiredMinimumVersion` / `requiredMaximumVersion`, `channelsEnabled`, and the MCP allowlist/denylist keys from §5.

---

## 9. Quick reference - every file at a glance

```text
~/.claude/
├── settings.json          # User settings
├── CLAUDE.md              # User memory
├── agents/                # User subagents
├── skills/                # User skills
├── commands/              # User slash commands
├── output-styles/         # User output styles
├── plans/                 # Plan-mode files
└── projects/<project>/    # Transcripts + auto memory

~/.claude.json             # OAuth, user+local MCP servers, per-project state

<project>/
├── CLAUDE.md              # Project memory (or .claude/CLAUDE.md)
├── CLAUDE.local.md        # Personal project memory (gitignored)
├── .mcp.json              # Project MCP servers (committed)
├── .worktreeinclude       # Files to copy into worktrees
└── .claude/
    ├── settings.json        # Project settings (committed)
    ├── settings.local.json  # Local overrides (gitignored)
    ├── agents/              # Project subagents
    ├── skills/              # Project skills
    └── commands/            # Project slash commands

System (managed):
/etc/claude-code/managed-settings.json          # Linux/WSL
/etc/claude-code/managed-mcp.json
/etc/claude-code/managed-settings.d/*.json      # Drop-in fragments
/Library/Application Support/ClaudeCode/...      # macOS equivalents
C:\Program Files\ClaudeCode\...                  # Windows equivalents
```

## 10. Debugging checklist

1. `/status` - confirms which settings sources loaded and flags invalid JSON
2. `/config` - interactive editor for common toggles
3. `/memory` - shows which CLAUDE.md files are actually in context
4. `/mcp` - server connection status, auth, reconnect
5. `/doctor` - general health, including skill-listing truncation
6. `/permissions` - review granted/denied tool permissions
7. Remember: scalars override by scope, arrays merge across scopes. If a permission rule "won't go away", check every scope - including managed.
