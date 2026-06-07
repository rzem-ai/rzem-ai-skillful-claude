# Claude Code Config Studio - Logical Structure

A desktop application for power users to visualise, manage, and directly edit Claude Code configuration. Three workspaces sit on top of a single shared configuration engine; the engine does the hard work, the workspaces are just lenses on it.

```text
┌─────────────────────────────────────────────────────────────┐
│  UI LAYER                                                   │
│  ┌──────────────┐ ┌──────────────────┐ ┌─────────────────┐  │
│  │ 1. Visualise │ │ 2. Guided Config │ │ 3. Raw Editor   │  │
│  │  (read-only) │ │  (no raw files)  │ │  (direct edit)  │  │
│  └──────┬───────┘ └────────┬─────────┘ └────────┬────────┘  │
├─────────┴──────────────────┴────────────────────┴───────────┤
│  DOMAIN LAYER - Configuration Engine                        │
│  • Source Registry      • Merge/Resolution Engine           │
│  • Write-Target Resolver• Validation Service                │
│  • Provenance Tracker   • Diff & Preview Service            │
├──────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                 │
│  • File Readers/Writers (atomic)  • File Watchers           │
│  • Backup Manager                 • Project Context Manager │
│  • OS Policy Readers (plist/registry, read-only)            │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. Domain layer - the configuration engine

Everything else depends on this. Build it first, test it hardest.

### 1.1 Source Registry

Discovers and tracks every configuration source for the current context:

| Source | Path | Writable? |
|---|---|---|
| Managed (server) | Anthropic admin console | No (display only) |
| Managed (MDM/registry) | plist / HKLM / HKCU | No |
| Managed (file) | `managed-settings.json` + `managed-settings.d/` | No (unless elevated, deliberately out of scope) |
| Managed MCP | `managed-mcp.json` | No |
| User settings | `~/.claude/settings.json` | Yes |
| Global state | `~/.claude.json` | Yes (selective keys only) |
| Project settings | `.claude/settings.json` | Yes |
| Local settings | `.claude/settings.local.json` | Yes |
| Project MCP | `.mcp.json` | Yes |
| Memory files | `~/.claude/CLAUDE.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md` | Yes |
| Auto memory | `~/.claude/projects/<project>/memory/` | Yes (with caution flag) |
| Subagents/skills/commands/output styles | `~/.claude/` and `.claude/` subdirectories | Yes |

Each source carries: scope, file path, parse status (valid / invalid JSON / schema violations), last modified, and writability.

### 1.2 Merge/Resolution Engine

Replicates Claude Code's precedence exactly. This is the single source of truth for "what config is actually in effect":

- Scope order: Managed > CLI args (simulated/optional) > Local > Project > User
- Scalar keys: highest scope wins
- Array keys (permission rules, sandbox paths, `allowedHttpHookUrls`, etc.): concatenate + deduplicate across all scopes
- Managed tier internal precedence: server > MDM/registry > file (with drop-in merge) > HKCU
- Permission rule evaluation order: deny → ask → allow, first match wins

Output: an **EffectiveConfig** object - every active key, its resolved value, and full provenance.

### 1.3 Provenance Tracker

For every resolved key: which source supplied the winning value, which sources were overridden (shadowed), and for arrays, which entries came from where. This powers most of the Visualise workspace.

### 1.4 Write-Target Resolver

The critical piece for the guided editor. Given (key, value, user intent), it determines the correct destination file and refuses invalid placements:

- Global-config keys (`autoConnectIde`, `teammateDefaultModel`, etc.) → must go to `~/.claude.json`, never settings.json (schema validation error otherwise)
- `permissions.defaultMode: "auto"` → user settings only (ignored in project/local since v2.1.142)
- `autoMemoryDirectory` → warn that project-scope placement requires workspace trust
- Managed-only keys (`strictKnownMarketplaces`, `forceLoginMethod`, ...) → blocked entirely, shown as "policy-controlled"
- MCP servers → route to `.mcp.json` (project) or the correct section of `~/.claude.json` (user/local, keyed by project path)
- Intent mapping: "just me, everywhere" → user; "this team/repo" → project; "just me, just here" → local

### 1.5 Validation Service

Three tiers:

1. **Syntactic** - JSON parse, markdown frontmatter parse
2. **Schema** - official Claude Code settings schema (fetched + cached, with a "schema may lag CLI" disclaimer), `.mcp.json` shape, subagent/skill frontmatter
3. **Semantic** - keys in wrong file, malformed permission rule syntax, `${VAR}` references with no default in contexts that need one, duplicate MCP server names across scopes, CLAUDE.md `@import` cycles or missing targets, deny rules that a lower-scope allow can never beat

### 1.6 Diff & Preview Service

Every write - guided or raw - produces: before/after file diff, and **before/after effective config diff** ("this change will be shadowed by project settings and have no visible effect" is the killer feature). Nothing touches disk without passing through here.

---

## 2. Data layer

- **Atomic writes**: write temp file → validate → rename. Never partial writes to live config.
- **Backup Manager**: timestamped backup before every write, retain N (mirror Claude Code's own 5-backup behaviour), one-click restore with diff preview.
- **File Watchers**: external edits (including Claude Code itself writing) trigger re-parse and re-resolution; UI updates live. Conflict detection if the app has unsaved changes to a file that changed underneath it.
- **Project Context Manager**: the app's equivalent of cwd. A project switcher (recent projects, browse) drives which project/local sources are active. Without a project selected, only user/managed/global sources resolve.
- **OS Policy Readers**: read-only adapters for macOS managed preferences and Windows registry policy keys, so the managed tier is visible even when not file-based.
- **Secrets hygiene**: values matching token patterns (in `env`, MCP `headers`, `apiKeyHelper` output) are masked by default with per-field reveal. Never logged, never in diffs unless revealed.

---

## 3. Workspace 1 - Visualise (read-only)

The "what is actually happening" view. No write paths from here; every element deep-links into workspace 2 or 3.

**3.1 Effective Config Dashboard**
- Searchable table of every resolved key: value, type, provenance chip (colour-coded by scope), shadowed-by indicators
- Filter by scope, category, or "differs from default"
- Click any key → side panel showing the full resolution chain top to bottom

**3.2 Scope Stack**
- Vertical layer cards: Managed → Local → Project → User, mirroring real precedence
- Each card: file path, parse status, key count, last modified, open-in-raw-editor link
- Health indicators: invalid JSON, empty/missing files, managed delivery channel shown in the badge (remote / plist / HKLM / file)

**3.3 Permissions Inspector**
- Merged rule list in actual evaluation order (deny → ask → allow) with per-rule source attribution
- **Rule tester**: type a hypothetical tool call (`Bash(git push origin main)`) → see which rule matches first and the outcome
- Sandbox view: effective filesystem allow/deny paths and network domain lists, including merges from permission rules

**3.4 MCP Server Map**
- All servers across all scopes; name-collision resolution shown explicitly (Local > Project > User)
- Per server: transport, target, env var references (resolved/unresolved status), enable/disable state from `enabledMcpjsonServers` etc., managed allowlist/denylist verdict

**3.5 Memory Map**
- Tree of CLAUDE.md files Claude would load for this project: upward recursion from project root, lazy-load subtree files marked as such
- `@import` graph with depth indicators (flag anything past 5 hops) and broken links
- Auto-memory summary: directory location, enabled state, MEMORY.md preview
- `claudeMdExcludes` matches greyed out with explanation

**3.6 Extensions Overview**
- Subagents, skills, commands, output styles, plugins: card grid with source scope, frontmatter summary, and skill-listing budget simulation (which descriptions would truncate at current `skillListingBudgetFraction`)

---

## 4. Workspace 2 - Guided Config (files hidden)

Form-driven editing. The user expresses intent; the Write-Target Resolver picks the file.

**4.1 Interaction pattern (uniform across all categories)**
1. User changes a control (toggle, dropdown, rule builder, path picker)
2. Scope selector: "Just me (all projects)" / "This project (shared with team)" / "Just me, this project" - with the resolver hiding invalid options per key
3. Inline effect note: "This will override your user-level setting" / "No effect - locked by managed policy"
4. Apply → diff preview (optional, toggleable for the impatient) → atomic write + backup

**4.2 Categories**

| Category | Representative controls |
|---|---|
| Permissions | Visual rule builder (tool picker + specifier with syntax help), drag-to-reorder within deny/ask/allow, default mode selector, additional directories picker |
| Model & Effort | Model dropdown, effort level, extended thinking toggle, output style |
| Environment | Key-value editor for `env` with masked values, common env-var quick-adds |
| Hooks | Event picker, command builder, HTTP hook URL with allowlist awareness, per-hook enable |
| Sandbox | Master toggle, path list editors with prefix helper (`/` vs `~/` vs `./` semantics explained inline), domain allow/deny lists |
| MCP Servers | Add wizard (transport → target → auth → scope), `${VAR}` insertion helper, test-connection button, enable/disable per project |
| Memory | CLAUDE.md section editor (structured: headings as cards), auto-memory toggle and relocation |
| Plugins & Marketplaces | Enable/disable per plugin@marketplace, add marketplace wizard |
| Worktrees | baseRef choice, symlink/sparse path lists, `.worktreeinclude` editor |
| Quality of Life | Attribution, update channel, status line, editor mode, spinner/notification settings, cleanup period |

**4.3 Locked state handling**
Managed-controlled keys render with a lock, the managed value, and the delivery channel. No silent failures - the user always knows *why* a control is disabled.

---

## 5. Workspace 3 - Raw Editor

For when the forms get in the way.

**5.1 File tree** (mirrors §1.1 Source Registry)
- Grouped by scope; managed tier visible but read-only with lock badges
- Parse-status dots; gitignore badges on local/CLAUDE.local.md files

**5.2 Editor**
- Code editor (Monaco-class) with per-file-type support:
  - settings.json / settings.local.json: JSON schema autocomplete + inline validation
  - `.mcp.json`: schema + `${VAR}` resolution hints on hover
  - `~/.claude.json`: structured guard rails - MCP and recognised settings sections editable, OAuth/cache sections folded and read-only by default ("here be dragons" toggle to unlock)
  - CLAUDE.md / subagents / skills / commands: markdown with frontmatter validation and live `@import` resolution preview
- Semantic lint gutter (from §1.5): wrong-file keys, bad rule syntax, etc.

**5.3 Save pipeline**
Same as guided: validate → effective-config diff preview → atomic write + backup. The raw editor gets no shortcut around validation; it can save with *warnings*, but never with broken JSON.

**5.4 Side-by-side mode**
Open the same key's resolution chain across files (user vs project vs local) in split view - the fastest way to debug "why won't this setting die".

---

## 6. Cross-cutting concerns

- **Live sync**: file watchers keep all three workspaces consistent with external changes; an active Claude Code session editing its own config shows up within seconds
- **Undo/redo**: app-level history on top of the backup manager
- **Audit log**: local, append-only record of every change the app made (file, diff hash, timestamp) - useful for the governance-minded
- **Read-only mode**: a global toggle for safely exploring someone else's machine or a production box
- **No elevation**: the app never writes to managed locations; managed config is strictly observed, never administered (that's MDM's job)
- **Single-instance file locking**: avoid clobbering between app instances

## 7. Suggested module breakdown

```text
config-engine/        # pure logic, no UI, fully unit-testable
  sources/            # discovery + parsers per file type
  resolution/         # merge engine + provenance
  validation/         # syntactic / schema / semantic
  writing/            # write-target resolver, atomic writer, backups
ui/
  visualise/
  guided/
  raw-editor/
  shared/             # provenance chips, scope selector, diff viewer
platform/
  watchers/           # FS events
  policy-readers/     # plist / registry adapters
  project-context/
```

The engine/UI split matters: the resolution and write-target logic should be a dependency-free library with exhaustive tests against known Claude Code behaviours (scalar override, array merge, the v2.1.142 auto-mode rule, global-config key routing). The UI is then just three views over one well-tested model.

## 8. Build sequence

1. Engine: source discovery + merge/resolution + provenance (read-only)
2. Visualise workspace on top of it - immediately useful with zero write risk
3. Validation service + atomic writer + backups
4. Raw editor (smaller surface than guided, exercises the write pipeline)
5. Write-target resolver + guided workspace
6. Watchers, audit log, polish
