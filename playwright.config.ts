import { defineConfig } from "@playwright/test";

// Electron e2e config.
//
// The tests spawn the packaged main bundle from ./out/main/index.js
// via Playwright's `_electron` helper. They share the real user
// filesystem (read ~/.claude.json, scan workspaces, etc.) so we keep
// `workers: 1` — running two Electron instances in parallel against
// the same FS is a recipe for flake.
//
// `npm run e2e` runs `electron-vite build` first so the bundles under
// ./out/{main,preload,renderer} always reflect the tree under test.

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
