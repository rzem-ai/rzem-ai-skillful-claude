# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Skillful Claude** is an Electron 33 + Vue 3 desktop app for Claude Code power
users. It answers one question — *"what configuration is actually in effect, and
why?"* — across the five config scopes (Managed › CLI › Local › Project › User)
and offers guided forms plus a raw editor to change it. Dark-first, dense,
developer-tool aesthetic (Linear/Tower/TablePlus, not a SaaS dashboard).

The UI was implemented from the design handoff in `design/design_prototype/`
(its `DESIGN-HANDOFF.md` is the visual contract). The **config engine is now
wired**: the main process reads real Claude Code config from disk, resolves it,
and pushes a typed `Snapshot` to the renderer over the preload bridge. Every
screen renders live data through a Pinia store (`src/stores/config.ts`); the
inline fixtures are gone. The guided forms (Permissions, Model, Environment,
MCP, Memory) and the Raw Editor perform real writes (atomic write + timestamped
backups). With no project selected, only
user/managed/global scopes resolve and screens fall back to empty states.

See `README.md` for build/run commands. Automated checks: `npm run typecheck`
(vue-tsc on the renderer + tsc on the main/preload project) and `npm test`
(Vitest over the engine, asserting the documented fixture ground-truth in
`docs/fixtures.md` plus a live-host smoke test). No linter or e2e suite.

## Architecture

### Three processes, one IPC seam

`electron-vite` builds three bundles, one per process:

- **Main (`electron/main/index.ts`)** — Node.js. Creates the BrowserWindow,
  loads the renderer, and calls `registerIpc(win)` (`electron/main/ipc.ts`),
  which wires the config engine + write pipeline to the renderer and starts the
  file watchers. The engine itself lives in `electron/main/engine/` (pure,
  Electron-free, Vitest-tested) and the write pipeline in
  `electron/main/writing/`.
- **Preload (`electron/preload/index.ts`)** — sandboxed `contextBridge` exposing
  `window.api`: thin `ipcRenderer.invoke` wrappers over the channels in
  `electron/shared/contract.ts` (`CH`), plus an `onChange` push subscription.
  Keep it, `api.d.ts`, and `ipc.ts` in lockstep with the contract.
- **Renderer (`src/`)** — the Vue 3 app (see below).

The IPC contract (`electron/shared/contract.ts`, alias `@shared`) is imported by
all three processes and is the single source of truth for the view-model shapes.
When adding a backend command, update the contract, the main handler, the
preload wrapper, and `api.d.ts` together.

### Renderer structure (`src/`)

- **`styles/app.css`** — the complete design system, the source of truth for
  visual style. Defines all tokens as CSS custom properties: neutral surfaces
  (`--bg`, `--surface-1..4`), text (`--fg`, `--fg-muted`, `--fg-dim`), the app
  accent (`--accent`, teal — chrome only), the five reserved **scope colors**
  (`--scope-managed|cli|local|project|user`), semantic state colors, type scale
  (`--t-cap|body|sec|view`), geometry, and layout dims. Light is the default
  theme (its values live in `:root`); dark theme overrides live under
  `:root[data-theme="dark"]`. These tokens are bridged into Tailwind
  v4 via `@theme` in `src/styles/tailwind.css`, so utilities (`bg-surface-2`,
  `text-fg-muted`, `text-scope-user`) resolve to the same variables and inherit
  theme switching for free. **Style new components with Tailwind utilities bound
  to these tokens (or the existing `app.css` classes) — never hex literals,
  Tailwind's default palette, or another UI framework like PrimeVue.**
- **`lib/icons.ts`** — the app's icon names mapped to Font Awesome 7 glyphs
  (light default, solid for active states); **`components/Icon.vue`** renders
  `<Icon name="grid" :size="16" />`.
- **`lib/scopes.ts`** + **`components/ProvenanceChip.vue`** — the signature
  component: scope color + icon + label, with an optional hover card.
- **`composables/useTheme.ts`** — `data-theme` on `<html>`, persisted to
  localStorage (`sc:theme`); `initTheme()` runs once at boot in `main.ts`.
- **`composables/useToast.ts`** + **`components/ToastHost.vue`** — global toast
  queue rendered once in `App.vue`.
- **`components/AppToolbar.vue`**, **`AppSidebar.vue`**, **`layouts/AppShell.vue`**
  — the shell chrome. `AppShell` is the `.app` CSS grid; it expects exactly
  three children (`.toolbar`, `.sidebar`, and the view's `.main`), so **every
  shell view's root element must be `<main class="main">`** (toggle
  `:class="{ 'show-inspector': open }"` when the view has an inspector aside).
- **`stores/config.ts`** — the one Pinia store over the engine. Loads the
  `Snapshot` via `window.api.snapshot()`, re-loads on `onChange` watcher pushes,
  and exposes per-workspace getters plus the write actions (`applyChange`,
  `saveFile`, `previewChange`, `pickProject`, `toggleReadOnly`). `App.vue` calls
  `init()` once at boot.
- **`views/`** — one component per screen: `DashboardView`, `ScopeStackView`,
  `PermissionsView`, `McpMapView`, `MemoryMapView`, `ExtensionsView`,
  `GuidedPermissionsView`, `GuidedModelView`, `GuidedEnvView`, `GuidedMcpView`,
  `GuidedMemoryView`, `RawEditorView`. Each pulls its data from the store and
  keeps screen-local presentation logic + `<style scoped>`. Screen-local
  view-model types come from `@shared/contract`. The guided forms share the
  write flow via `composables/useGuidedWrites.ts` + `GuidedApplyBar` +
  `GuidedDiffModal`.

### Routing (`src/router/index.ts`)

Hash history (`createWebHashHistory`) — packaged Electron loads the renderer
over `file://`, where HTML5 history breaks. Every screen renders inside
`AppShell` via a **layout route**: a parent at `/` whose children use absolute
paths (`/dashboard`, `/permissions`, …); the empty-path index child redirects to
`/dashboard`. Each child sets `meta.navId`, which `AppSidebar` reads to
highlight the active item.

## Things to know

- **ESM all the way**: `package.json` has `"type": "module"`. Derive `__dirname`
  via `dirname(fileURLToPath(import.meta.url))` in the main process.
- **Sandbox is off**: ESM preloads require `sandbox: false`; the renderer is
  still walled off via `contextIsolation: true` + `nodeIntegration: false`.
- **Styling — Tailwind v4 + the `app.css` design system, token-bridged**:
  PrimeVue is gone, but Tailwind v4 was (re)introduced and is now the
  **Tailwind-first** default for new view code. It's wired via the
  `@tailwindcss/vite` plugin (renderer block of `electron.vite.config.ts`); there
  is no `postcss.config`, `autoprefixer`, or `tailwind.config.js` — config lives
  in CSS. `src/styles/tailwind.css` imports Tailwind (**Preflight deliberately
  omitted** — only the `theme` + `utilities` layers, so Tailwind's reset doesn't
  clobber the app's own base styles) and bridges every design token into `@theme`.
  It's imported before `app.css` in `main.ts`. The hand-built `app.css`
  component classes (`.btn`, `.chip`, `.tbl`, `.insp-*`, …) still exist and are
  being migrated to utilities/`@apply` incrementally (`DashboardView.vue` is the
  converted reference). Two gotchas: `app.css` rules are **unlayered**, so they
  win over layered Tailwind utilities — a utility can't override a property an
  `app.css` class already sets on the same element (recolor in scoped CSS or
  migrate the class instead); and because Preflight is off, border utilities need
  an explicit `border-solid`. Stay on the bridged tokens — no hex literals or
  Tailwind default-palette colors.
- **Real data via the engine**: every value on screen comes from the live
  `Snapshot` through the Pinia store. The engine (`electron/main/engine/`) is
  pure logic with exhaustive Vitest coverage against `docs/fixtures.md` — change
  resolution behaviour there and assert it in `engine.test.ts`, not in the views.
- **Writes are guarded**: all writes go through `electron/main/writing/` (atomic
  temp+rename, 5-deep backups) and the write-target resolver, which refuses
  managed scopes and the auto-mode-in-non-user case. Read-only mode blocks them.
- **Updater publish target is real**: `electron-builder.yml` points at
  `rzem-ai/rzem-ai-skillful-claude`. Don't run `npm run release` from a fork.
- Per-user Claude Code settings live in `.claude/` and are gitignored.
