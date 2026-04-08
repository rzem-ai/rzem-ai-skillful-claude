# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

Skillful Claude is an Electron 33 + Vue 3 desktop app for managing `CLAUDE.md` files and SKILLS (`SKILL.md` + frontmatter) across a developer's projects and global Claude config. The dashboard renders the relationship between a global root `CLAUDE.md`, project `CLAUDE.md` files, and the SKILLS attached to each as a Vue Flow graph. The Electron main process reads/writes those files and shells out to the bundled `vercel-labs/skills` CLI; the Vue renderer edits them.

## Commands

```bash
# Full desktop dev loop (electron-vite spawns main + preload + renderer
# with HMR for the renderer). Renderer dev server is on port 1420.
npm run dev

# Type-check then build all three bundles into ./out
npm run build

# Type-check only (vue-tsc on the renderer + tsc on the main process)
npm run typecheck

# Package distributables for the current host into ./dist-builds
# (uses electron-builder, no publish)
npm run package

# Per-platform variants
npm run package:linux    # AppImage, deb, rpm
npm run package:mac      # dmg (x64 + arm64)
npm run package:win      # nsis x64

# Build and publish a release to GitHub Releases (drives auto-update)
npm run release
```

There is no test runner or linter wired up yet. `npm run typecheck` (vue-tsc on `tsconfig.web.json` + tsc on `tsconfig.node.json`) is the only static check.

## Architecture

### Three processes, one IPC seam

This is a standard Electron app split into three processes, each built as a separate bundle by `electron-vite`:

- **Main (`electron/main/`)** — Node.js. Owns the BrowserWindow, the filesystem, the auto-updater, and the spawned `vercel-labs/skills` CLI. Entry: `electron/main/index.ts`. Modules:
  - `fs.ts` — port of the old Rust file commands. Scans workspaces for `CLAUDE.md` / `SKILL.md`, parses YAML frontmatter via `gray-matter`, hashes content with Node `crypto`.
  - `config.ts` — port of the global config loader. Walks `~/.claude.json`, `~/.claude/{settings.json,CLAUDE.md,skills/**}`, and per-project files.
  - `skills-cli.ts` — wraps the bundled `skills` npm package as a child process. Both one-shot (`runSkillsCli`) and streaming (`startSkillsCli` → chunk events) variants.
  - `updater.ts` — `electron-updater` wired to GitHub Releases. No-ops in dev.
  - `ipc.ts` — registers every `ipcMain.handle(...)` channel. Single source of truth for the IPC surface.
- **Preload (`electron/preload/`)** — sandboxed bridge. Uses `contextBridge.exposeInMainWorld("api", api)` to expose typed wrappers around each IPC channel. The renderer sees `window.api.fs.scanWorkspace(...)`, `window.api.skills.exec(...)`, etc. Type declarations live in `electron/preload/api.d.ts`.
- **Renderer (`src/`)** — the Vue 3 app. Unchanged from the Tauri version except that the IPC composable is now `src/composables/useDesktopApi.ts` (forwarding to `window.api.*`) instead of the old `useTauriFs.ts` (which called `invoke()`).

The IPC surface is `<namespace>:<verb>` (`fs:scanWorkspace`, `config:load`, `skills:run`, `skills:exec`, `skills:cancel`, `updater:check`, etc.). **When adding a command, update all three layers**: the main-side handler (`electron/main/`), the preload bridge (`electron/preload/index.ts` + `api.d.ts`), and the renderer composable (`src/composables/useDesktopApi.ts`). They're coupled by design — the bridge is the only seam.

### File classification is centralized

`electron/main/fs.ts` is the heart of the backend. Every read/write command starts by calling `classify(path)`, which only accepts files literally named `CLAUDE.md` or `SKILL.md`. Anything else throws `AppError("UnsupportedFile", path)`. If you add a new managed file type (e.g. `settings.json`), extend the `WorkspaceEntryKind` union, `classify()`, and the scanner's filter together — they're coupled by design so the app can't accidentally write to arbitrary paths.

`scanWorkspace` is depth-limited (`MAX_SCAN_DEPTH = 8`) and skips `node_modules`, `.git`, `target`, `dist`, `.next`, `.venv`. This is intentional protection against the user accidentally pointing it at `/` or a huge monorepo — preserve those guards. Implemented as a manual recursive walk (not `fs.readdir { recursive: true }`) so we can prune skipped directories *before* recursing into them.

### vercel-labs/skills integration

The `skills` package (currently `^1.4.9`) is shipped as a runtime dependency. We never call its internals — we spawn the CLI binary as a child process via `spawn(process.execPath, [entry, ...args], { env: { ELECTRON_RUN_AS_NODE: "1" } })`, which uses Electron's bundled Node interpreter so we don't depend on `node`/`npx` being on the user's PATH.

In packaged builds, `skills` lives in `app.asar.unpacked/node_modules/skills` (see `electron-builder.yml` → `asarUnpack`), because asar-archived files can't be executed directly. `skills-cli.ts` falls back to that path when `require.resolve` can't find it.

The streaming variant (`startSkillsCli`) returns a `jobId` and pipes stdout/stderr chunks back via `webContents.send("skills:chunk", ...)` so the **PrimeVue Terminal view** (`src/views/SkillsTerminalView.vue`) can render output live as the CLI runs. The view tracks the active jobId and forwards each chunk into `TerminalService.emit("response", line)` after stripping ANSI escapes.

### Auto-update

`electron-updater` is configured to read from GitHub Releases (provider: `github`, owner: `rzem-ai`, repo: `rzem-ai-skillful-claude` — see `electron-builder.yml` → `publish`). To ship a release:

1. Bump `version` in `package.json`.
2. Run `npm run release` (which builds, packages, and publishes).
3. The CI environment must have `GH_TOKEN` set to a token with `repo` scope.

In development the updater is a no-op because `app.isPackaged` is false. The renderer can call `window.api.updater.check()` and listen on `window.api.updater.onStatus(...)` for progress events.

### Frontend state model

A single Pinia store (`src/stores/workspace.ts`) holds the currently scanned workspace: `scope` (workspace vs global), `root`, `entries`, plus loading/error. A second store (`src/stores/config.ts`) holds the loaded `~/.claude.json` tree. Views subscribe to both stores; they don't call IPC themselves — everything goes through `useDesktopApi.ts` so the boundary stays in one place.

Routes are sidebar-driven: each route in `src/router/index.ts` carries a `meta.sidebar` key the `SideBar` component reads to highlight the active section. Adding a top-level page = new route + matching sidebar entry.

### Canvas (`DashboardView`)

The graph uses Vue Flow with two custom node types (`ClaudeMdNode`, `SkillNode`) registered via `markRaw` — Vue Flow requires non-reactive node type maps. Nodes and edges are derived from the loaded `useConfigStore`: a single `root` node for the global `~/.claude/CLAUDE.md`, one column per live project that has either a `CLAUDE.md` or local skills, and skill nodes stacked beneath each column. Edges connect root → global skills and root → project CLAUDE.md → project skills (or root → skill directly when a project has skills but no `CLAUDE.md`). The layout is index-driven for now; a dagre auto-layout is a follow-up. Node `id`s are stable composite strings (`skill-g-${path}`, `project-${path}`, etc.) so they survive adds/removes without reordering.

### Design tokens

Tailwind v4 reads color tokens (`--color-page`, `--color-claude`, `--color-skill`, etc.) from `@theme` in `src/styles/main.css`, so utilities like `bg-page`, `text-strong`, `border-line` work without a `tailwind.config.js`. The palette is lifted from `design/skillful-claude-ui.pen` — keep new components on these tokens rather than hex literals so dark mode and theme changes stay consistent.

### Icons

The full platform-specific icon set under `build/` is generated from a single SVG source at `design/icon-source.svg` by `scripts/build-icons.mjs` (runnable as `npm run icons`). The script uses `sharp` to render the SVG to a 1024×1024 PNG and `electron-icon-builder` to emit `build/icon.icns`, `build/icon.ico`, and `build/icons/<size>x<size>.png` for Linux. The current SVG is a brand-orange squircle with a sparkle glyph as a placeholder — drop a real vector source in at the same path and re-run `npm run icons` to ship polished artwork.

## Things to know

- **ESM all the way**: `package.json` has `"type": "module"`. The main process is ESM, so `__dirname` doesn't exist — derive it via `dirname(fileURLToPath(import.meta.url))` (already done in `electron/main/index.ts`).
- **Sandbox is off**: ESM preloads require `sandbox: false` on the BrowserWindow. The renderer is still safely walled off via `contextIsolation: true` + `nodeIntegration: false` — the only way for renderer code to reach Node is through the preload bridge.
- **Updater publish target is real**: `electron-builder.yml` points at `rzem-ai/rzem-ai-skillful-claude` on GitHub. Don't run `npm run release` from a fork or you'll publish to the wrong repo.
- **`asarUnpack` matters**: the `skills` CLI must remain in `asarUnpack` or `child_process.spawn` can't execute it inside a packaged app.
- **Updates panel**: Settings → Updates surfaces `window.api.updater.{check,onStatus,quitAndInstall}`. It shows the running version (from `app.getVersion()`), the live download progress, and an "Install & restart" button that becomes visible once an update has been downloaded. In dev the buttons render but the underlying calls no-op because `app.isPackaged` is false; the panel makes that explicit with an inline notice.
- Per-user Claude Code settings live in `.claude/` and are gitignored — don't commit anything there.
- `electron-log` writes main-process logs to the standard per-OS path under `app.getPath("userData")`. Useful for debugging "why didn't the updater fire" in a packaged build.
