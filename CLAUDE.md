# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Skillful Claude** is an Electron 33 + Vue 3 desktop app for Claude Code power
users. It answers one question — *"what configuration is actually in effect, and
why?"* — across the five config scopes (Managed › CLI › Local › Project › User)
and offers guided forms plus a raw editor to change it. Dark-first, dense,
developer-tool aesthetic (Linear/Tower/TablePlus, not a SaaS dashboard).

The current codebase is the **front-end build** of that product, implemented
from the design handoff in `design/design_prototype/` (its `DESIGN-HANDOFF.md`
is the visual contract). All nine screens render against **static fixture
data** — there is no backend wired up yet: the preload bridge exposes an empty
`api` and the main process registers no IPC handlers. Wiring real
filesystem/config reads is the next phase.

See `README.md` for build/run commands. The only automated check is
`npm run typecheck` (vue-tsc on the renderer + tsc on the main/preload project).
There is no test runner, linter, or e2e suite.

## Architecture

### Three processes, one IPC seam

`electron-vite` builds three bundles, one per process:

- **Main (`electron/main/index.ts`)** — Node.js. Creates the BrowserWindow,
  loads the renderer, wires `electron-log`. No IPC handlers yet — register new
  `ipcMain.handle(...)` channels here when adding backend capability.
- **Preload (`electron/preload/index.ts`)** — sandboxed `contextBridge` exposing
  `window.api`. Currently an **empty** `api = {}`; grow it (and `api.d.ts`) in
  lockstep with the main process. The bridge is the only seam through which
  renderer code can reach Node.
- **Renderer (`src/`)** — the Vue 3 app (see below).

When adding a backend command, update all three layers together.

### Renderer structure (`src/`)

- **`styles/app.css`** — the complete design system, the source of truth for
  visual style. Defines all tokens as CSS custom properties: neutral surfaces
  (`--bg`, `--surface-1..4`), text (`--fg`, `--fg-muted`, `--fg-dim`), the app
  accent (`--accent`, teal — chrome only), the five reserved **scope colors**
  (`--scope-managed|cli|local|project|user`), semantic state colors, type scale
  (`--t-cap|body|sec|view`), geometry, and layout dims. Light theme overrides
  live under `:root[data-theme="light"]`. **Style new components with these
  tokens and the existing classes — not hex literals, Tailwind, or PrimeVue.**
- **`lib/icons.ts`** — the inline-SVG path set; **`components/Icon.vue`** renders
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
- **`views/`** — one component per screen: `OverviewView` (launcher, no shell),
  `DashboardView`, `ScopeStackView`, `PermissionsView`, `McpMapView`,
  `MemoryMapView`, `ExtensionsView`, `GuidedPermissionsView`, `RawEditorView`.
  Each holds its own typed fixture data and screen-local `<style scoped>`.

### Routing (`src/router/index.ts`)

Hash history (`createWebHashHistory`) — packaged Electron loads the renderer
over `file://`, where HTML5 history breaks. `OverviewView` sits at `/` outside
the shell. Every other screen renders inside `AppShell` via a **layout route**:
a parent with a non-colliding path (`/_shell`) whose children use absolute
paths (`/dashboard`, `/permissions`, …). Each child sets `meta.navId`, which
`AppSidebar` reads to highlight the active item.

## Things to know

- **ESM all the way**: `package.json` has `"type": "module"`. Derive `__dirname`
  via `dirname(fileURLToPath(import.meta.url))` in the main process.
- **Sandbox is off**: ESM preloads require `sandbox: false`; the renderer is
  still walled off via `contextIsolation: true` + `nodeIntegration: false`.
- **Tailwind & PrimeVue are installed but unused** by these screens — the
  prototype ships its own design system in `app.css`. Don't reach for them when
  building Config screens; stay on the `app.css` tokens/classes.
- **Fixtures, not real data**: every value on screen is a typed `const` inside
  its view. When the backend lands, replace the fixtures with IPC calls — keep
  the same shapes so the templates don't change.
- **Updater publish target is real**: `electron-builder.yml` points at
  `rzem-ai/rzem-ai-skillful-claude`. Don't run `npm run release` from a fork.
- Per-user Claude Code settings live in `.claude/` and are gitignored.
