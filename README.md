# Skillful Claude

A desktop app for managing `CLAUDE.md` and `SKILL.md` files across your projects and global Claude Code config. Built with Electron 33, Vue 3, and TypeScript. Bundles the `vercel-labs/skills` CLI for skill execution.

See [`CLAUDE.md`](./CLAUDE.md) for architecture notes and contributor guidance.

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

# Regenerate the icon set from design/icon-source.svg
npm run icons

# Playwright end-to-end tests (builds with electron-vite first, then
# drives the main bundle via @playwright/test's _electron helper).
npm run e2e
npm run e2e:headed
```

`npm run typecheck` runs vue-tsc on `tsconfig.web.json` plus tsc on
`tsconfig.node.json` and `tsconfig.e2e.json`. That, plus the Playwright
e2e suite under `e2e/`, are the automated checks — there is no unit-test
runner or linter wired up.

## Releasing

Auto-update is wired to GitHub Releases at `rzem-ai/rzem-ai-skillful-claude` via `electron-updater`. To ship a release:

1. Bump `version` in `package.json`.
2. Run `npm run release` (which builds, packages, and publishes).
3. The CI environment must have `GH_TOKEN` set to a token with `repo` scope.

Don't run `npm run release` from a fork — it will publish to the wrong repo.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) with the [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) extension.
