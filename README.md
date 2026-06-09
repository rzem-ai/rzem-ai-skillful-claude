# Skillful Claude

An Electron 33 + Vue 3 + TypeScript desktop app for Claude Code power users:
a dark-first, dense diagnostic instrument that answers *"what configuration is
actually in effect, and why?"* across the five config scopes (Managed › CLI ›
Local › Project › User).

All eight screens (Dashboard, Scope Stack, Permissions, MCP Map, Memory Map,
Extensions, Guided Permissions, Raw Editor) are implemented from the design
handoff in [`design/design_prototype/`](./design/design_prototype) and render
**live data from a real config engine**. The main process discovers and parses
every Claude Code config file, replicates Claude Code's precedence
(scalar override, array merge, the v2.1.142 auto-mode rule, global-config-key
routing, managed locks, secret masking), and pushes a typed `Snapshot` to the
renderer over the preload bridge; file watchers keep it live. The Guided and Raw
workspaces write back through an atomic write + timestamped-backup pipeline with
a write-target resolver. The engine (`electron/main/engine/`) is pure,
Electron-free logic with a Vitest suite asserting the documented ground-truth in
[`docs/fixtures.md`](./docs/fixtures.md).

See [`CLAUDE.md`](./CLAUDE.md) for architecture notes and
[`VISION.md`](./VISION.md) for product direction.

## Commands

```bash
# Full desktop dev loop (electron-vite spawns main + preload + renderer
# with HMR for the renderer). Renderer dev server is on port 1420.
npm run dev

# Type-check then build all three bundles into ./out
npm run build

# Type-check only (vue-tsc on the renderer + tsc on the main process)
npm run typecheck

# Run the engine test suite (Vitest)
npm test

# Package distributables for the current host into ./dist-builds
npm run package

# Per-platform variants
npm run package:linux    # AppImage, deb, rpm
npm run package:mac      # dmg (x64 + arm64)
npm run package:win      # nsis x64

# Build and publish a release to GitHub Releases
npm run release
```

`npm run typecheck` runs vue-tsc on `tsconfig.web.json` plus tsc on
`tsconfig.node.json`. `npm test` runs Vitest over the config engine
(`electron/main/engine/`), asserting the documented fixture ground-truth in
[`docs/fixtures.md`](./docs/fixtures.md) plus a live-host smoke test. There is no
linter or e2e suite.

## Releasing

`electron-builder` publishes to GitHub Releases at
`rzem-ai/rzem-ai-skillful-claude`. To ship a build:

1. Bump `version` in `package.json`.
2. Run `npm run release` (builds, packages, and publishes).
3. CI must have `GH_TOKEN` set to a token with `repo` scope.

In-app auto-update (`electron-updater`) was removed in the strip; re-add it
when the new version needs it. Don't run `npm run release` from a fork — it
will publish to the wrong repo.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) with the [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) extension.
