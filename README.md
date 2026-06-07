# Skillful Claude

An Electron 33 + Vue 3 + TypeScript desktop app skeleton.

This is the stripped-down skeleton: a working three-process Electron shell
(main / preload / renderer) with the `electron-vite` build chain, Tailwind v4
design tokens, and a PrimeVue/Pinia/Vue Router stack installed but unwired.
The v1 feature code (workspace scanning, config loading, the bundled `skills`
CLI, auto-update, and the nine UI views) was removed so a new version can be
built on top. The product direction lives in [`VISION.md`](./VISION.md) and
[`design/claude-design-brief.md`](./design/claude-design-brief.md).

See [`CLAUDE.md`](./CLAUDE.md) for architecture notes.

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
npm run package

# Per-platform variants
npm run package:linux    # AppImage, deb, rpm
npm run package:mac      # dmg (x64 + arm64)
npm run package:win      # nsis x64

# Build and publish a release to GitHub Releases
npm run release
```

`npm run typecheck` runs vue-tsc on `tsconfig.web.json` plus tsc on
`tsconfig.node.json`. There is no unit-test runner, linter, or e2e suite
wired up — they were stripped with the v1 features.

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
