# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This is the **stripped skeleton** of Skillful Claude — an Electron 33 + Vue 3
desktop app. The v1 implementation (managing `CLAUDE.md` / `SKILL.md` files,
a Vue Flow dashboard, the bundled `vercel-labs/skills` CLI, auto-update, and
nine UI views) was removed so a new version can be built on the bones. The
intended product direction lives in `VISION.md` and
`design/claude-design-brief.md`.

What remains is a launchable three-process Electron shell and its build chain.
Nothing feature-specific is wired up. See `README.md` for build/run commands.
The only automated check is `npm run typecheck` (vue-tsc on the renderer plus
tsc on the main/preload TS project) — there is no test runner, linter, or e2e
suite.

## Architecture

### Three processes, one IPC seam

`electron-vite` builds three separate bundles, one per process:

- **Main (`electron/main/`)** — Node.js. Owns the BrowserWindow. Entry:
  `electron/main/index.ts`. Currently just creates the window and loads the
  renderer; `electron-log` is wired for main-process logging. Register new
  `ipcMain.handle(...)` channels here.
- **Preload (`electron/preload/`)** — sandboxed bridge. `index.ts` calls
  `contextBridge.exposeInMainWorld("api", api)` with an **empty** `api` object
  — the template to grow. Renderer-side type declarations live in `api.d.ts`.
- **Renderer (`src/`)** — the Vue 3 app. Stripped to `main.ts` (mounts
  `App.vue`) and `App.vue` (renders "Hello"). Pinia, Vue Router, PrimeVue and
  the Iconify Lucide set are installed but intentionally **not** wired into
  `main.ts` — add them back as the rebuild needs them.

The IPC surface convention is `<namespace>:<verb>` (e.g. `fs:scanWorkspace`).
**When adding a command, update all three layers**: the main-side handler
(`electron/main/`), the preload bridge (`electron/preload/index.ts` +
`api.d.ts`), and the renderer. They're coupled by design — the bridge is the
only seam through which renderer code can reach Node.

### Build layout (`electron.vite.config.ts`)

- `electron/main` → main process (Node)
- `electron/preload` → preload (Node, sandboxed bridge)
- `src/` → renderer (Vue), root `.`, `@` aliased to `./src`, dev server on
  port 1420

`externalizeDepsPlugin()` keeps Node deps out of the main/preload bundles so
they resolve from `node_modules` at runtime.

### Design tokens

Tailwind v4 reads color tokens (`--color-page`, `--color-strong`,
`--color-line`, etc.) from `@theme` in `src/styles/main.css`, so utilities
like `bg-page`, `text-strong`, `border-line` work without a
`tailwind.config.js`. Keep new components on these tokens rather than hex
literals so theming stays consistent. The palette is carried over from the
design brief.

## Things to know

- **ESM all the way**: `package.json` has `"type": "module"`. The main process
  is ESM, so `__dirname` doesn't exist — derive it via
  `dirname(fileURLToPath(import.meta.url))` (already done in
  `electron/main/index.ts`).
- **Sandbox is off**: ESM preloads require `sandbox: false` on the
  BrowserWindow. The renderer is still walled off via `contextIsolation: true`
  + `nodeIntegration: false` — the only way to reach Node is the preload bridge.
- **`asarUnpack` matters**: if you re-add a CLI that gets spawned via
  `child_process`, or a dep with native binaries, list it under `asarUnpack`
  in `electron-builder.yml` or it can't be executed inside a packaged app.
- **Updater publish target is real**: `electron-builder.yml` points at
  `rzem-ai/rzem-ai-skillful-claude` on GitHub. Don't run `npm run release`
  from a fork or you'll publish to the wrong repo. In-app auto-update
  (`electron-updater`) was removed in the strip — re-add it if needed.
- **Icons were stripped**: `build/` icon assets are gone, so packaging falls
  back to the default Electron icon. Drop a real icon set back under `build/`
  and re-add the `icon:` keys in `electron-builder.yml` when branding.
- Per-user Claude Code settings live in `.claude/` and are gitignored — don't
  commit anything there.
