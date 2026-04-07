# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

Skillful Claude is a Tauri 2 + Vue 3 desktop app for managing `CLAUDE.md` files and SKILLS (`SKILL.md` + frontmatter) across a developer's projects and global Claude config. The dashboard renders the relationship between a global root `CLAUDE.md`, project `CLAUDE.md` files, and the SKILLS attached to each as a Vue Flow graph. The Rust backend reads/writes those files; the Vue frontend edits them.

## Commands

```bash
# Frontend-only dev (Vite, port 1420 — strict, fails if taken)
npm run dev

# Full desktop dev loop (spawns Vite + Rust). The env -u stripping of
# GTK_PATH/GIO_MODULE_DIR works around Linux GTK conflicts and is required.
npm run tauri:dev

# Type-check + build the web bundle into ./dist
npm run build

# Full release build (web bundle + native bundles)
npm run tauri:build

# Regenerate app icons from public/icon.png
npm run tauri:icons
```

There is no test runner or linter wired up yet. `vue-tsc --noEmit` (run as part of `npm run build`) is the only static check.

The two `build-release-*.sh` scripts wrap `tauri build` per-platform: they bundle each target separately (`deb`/`rpm`/`appimage` on Linux, `app`/`dmg`/`ios` on macOS) to dodge a "Text file busy" error you hit when bundling them all in one invocation, then collect artifacts into `releases/`. Note these scripts still print "SpriteChat" in their log lines — leftover from a template, not a different product.

## Architecture

### Two halves, one IPC seam

- **Frontend (`src/`)** — Vue 3 + `<script setup>`, Pinia, Vue Router (web history), PrimeVue (Aura preset, dark mode via `.dark` selector), Tailwind v4 (config-less, tokens defined in `src/styles/main.css` via `@theme`), Vue Flow for the canvas, Milkdown for markdown editing. The `@/*` alias points at `src/`.
- **Backend (`src-tauri/src/`)** — Rust, async Tokio for FS, `walkdir` for scanning, `gray_matter` (YAML engine) for SKILL frontmatter parsing, `sha2` for content hashing. Plugins enabled: `fs`, `dialog`, `updater`, `sql` (sqlite). The capability allow-list lives in `src-tauri/capabilities/default.json` — adding new FS/dialog/updater operations means updating both the Rust handler and that JSON.

The seam between them is a small set of `#[tauri::command]`s registered in `src-tauri/src/lib.rs` and mirrored as typed wrappers in `src/composables/useTauriFs.ts`. **When adding a command, always update both sides plus the capabilities file.** Models in `src-tauri/src/models/` use `#[serde(rename_all = "camelCase")]` so Rust `snake_case` fields become JS `camelCase` — keep the TS interface in `useTauriFs.ts` in sync.

### File classification is centralized

`src-tauri/src/commands/files.rs` is the heart of the backend. Every read/write command starts by calling `classify(&path)`, which only accepts files literally named `CLAUDE.md` or `SKILL.md`. Anything else returns `AppError::UnsupportedFile`. If you add a new managed file type (e.g. `settings.json`), extend `WorkspaceEntryKind`, `classify`, and the scanner's filter together — they're coupled by design so the app can't accidentally write to arbitrary paths.

`scan_workspace` is depth-limited (`MAX_SCAN_DEPTH = 8`) and skips `node_modules`, `.git`, `target`, `dist`, `.next`, `.venv`. This is intentional protection against the user accidentally pointing it at `/` or a huge monorepo — preserve those guards.

### Frontend state model

A single Pinia store (`src/stores/workspace.ts`) holds the currently scanned workspace: `scope` (workspace vs global), `root`, `entries`, plus loading/error. Views subscribe to this; they don't call `invoke` themselves — they go through `useTauriFs.ts` wrappers so the IPC surface stays in one place.

Routes are sidebar-driven: each route in `src/router/index.ts` carries a `meta.sidebar` key the `SideBar` component reads to highlight the active section. Adding a top-level page = new route + matching sidebar entry.

### Canvas (`DashboardView`)

The graph uses Vue Flow with two custom node types (`ClaudeMdNode`, `SkillNode`) registered via `markRaw` — Vue Flow requires non-reactive node type maps. Today the dashboard seeds a hard-coded sample graph; the real wiring to `workspace.entries` is still TODO. When you connect them, remember Vue Flow node `id`s must be stable strings (don't use array indexes that shift on add/remove).

### Design tokens

Tailwind v4 reads color tokens (`--color-page`, `--color-claude`, `--color-skill`, etc.) from `@theme` in `src/styles/main.css`, so utilities like `bg-page`, `text-strong`, `border-line` work without a `tailwind.config.js`. The palette is lifted from `design/claude-config-ui.pen` — keep new components on these tokens rather than hex literals so dark mode and theme changes stay consistent.

## Things to know

- The Tauri config's `beforeDevCommand`/`beforeBuildCommand` use **pnpm**, but the active lockfile is `package-lock.json` (npm) — `pnpm-lock.yaml` is stale. Run `npm` commands directly; if you go through `tauri dev`, it'll still try to spawn `pnpm dev`. Either install pnpm or invoke `vite`/`npm run dev` and `tauri dev` separately.
- The updater plugin is enabled but `tauri.conf.json` still has placeholder values (`releases.example.com`, `REPLACE_WITH_TAURI_SIGNER_PUBKEY`). Don't ship a real release without filling these in.
- Per-user Claude Code settings live in `.claude/` and are gitignored — don't commit anything there.
- The `_lib` suffix on the Rust crate (`skillful_claude_lib`) is a Windows linker workaround per the comment in `Cargo.toml`; leave it alone.
