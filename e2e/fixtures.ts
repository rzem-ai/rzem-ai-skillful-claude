import { _electron as electron, test as base, type ElectronApplication, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// `e2e/fixtures.ts` is ESM (the project is "type": "module"), so derive
// __dirname manually and resolve the built main bundle relative to the
// repo root. The test script must have run `electron-vite build` first.
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const MAIN_ENTRY = resolve(REPO_ROOT, "out", "main", "index.js");

// Console messages we tolerate at boot time. These are non-fatal and
// depend on Chromium internals we don't control.
//   • Autofill.enable / Autofill.setAddresses — fired by the DevTools
//     protocol in Electron and already known upstream noise.
//   • Milkdown ProseMirror "unsupported browser" style warnings don't
//     currently fire, but we reserve the matcher here so future
//     third-party noise can be added without editing every test.
const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  /Autofill\.(enable|setAddresses)/i,
  /Request Autofill\.enable failed/i,
];

export interface ConsoleCollector {
  errors: string[];
  all: { type: string; text: string }[];
}

interface ElectronFixtures {
  electronApp: ElectronApplication;
  page: Page;
  consoleCollector: ConsoleCollector;
}

export const test = base.extend<ElectronFixtures>({
  // Launch a fresh Electron app per test. Per-test isolation is cheap
  // here (one Electron instance spins up in ~1-2s) and keeps tests from
  // leaking state through the renderer's Pinia stores.
  electronApp: async ({ }, use) => {
    const app = await electron.launch({
      args: [MAIN_ENTRY],
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        NODE_ENV: "test",
        // Disable the auto-updater explicitly. It's already a no-op in
        // dev (`app.isPackaged` is false), but setting this guards
        // against anyone flipping the packaged flag in CI.
        ELECTRON_UPDATER_DISABLED: "1",
      },
    });
    await use(app);
    await app.close();
  },

  // Most tests want the first window and a console collector plumbed in
  // before anything renders. Wiring both here keeps individual specs
  // short.
  page: async ({ electronApp, consoleCollector }, use) => {
    const window = await electronApp.firstWindow();

    window.on("console", (msg) => {
      const text = msg.text();
      consoleCollector.all.push({ type: msg.type(), text });
      if (msg.type() === "error" && !IGNORED_CONSOLE_PATTERNS.some((re) => re.test(text))) {
        consoleCollector.errors.push(text);
      }
    });

    window.on("pageerror", (err) => {
      const text = err.message;
      consoleCollector.all.push({ type: "pageerror", text });
      if (!IGNORED_CONSOLE_PATTERNS.some((re) => re.test(text))) {
        consoleCollector.errors.push(text);
      }
    });

    await window.waitForLoadState("domcontentloaded");
    // The renderer boots an async loadAll() the instant AppShell mounts
    // — wait until either the loading spinner is gone or the error panel
    // is showing before handing the page off to the test.
    await window
      .waitForFunction(
        () => {
          const root = document.getElementById("app");
          if (!root) return false;
          // Either the sidebar mounts (normal path) or the error panel
          // is visible (FS read failed) — either state is "ready".
          if (root.querySelector("aside") !== null) return true;
          const text = root.textContent ?? "";
          if (text.includes("Couldn't load Claude config")) return true;
          return false;
        },
        null,
        { timeout: 10_000 },
      )
      .catch(() => {
        // Don't fail the fixture if the wait times out — the test body
        // will assert on visible content and report a clearer failure.
      });

    await use(window);
  },

  consoleCollector: async ({ }, use) => {
    const collector: ConsoleCollector = { errors: [], all: [] };
    await use(collector);
  },
});

export const expect = test.expect;

/**
 * Navigate the renderer via the in-memory vue-router rather than a URL
 * load. The prod build uses `createWebHistory` and serves from a
 * `file://` origin where `page.goto("/settings")` would fail.
 *
 * Vue 3 stashes the app instance on the mount element as `__vue_app__`
 * and exposes `$router` via `config.globalProperties`. We walk that
 * chain and call `router.push(path)`, then wait for the URL pathname
 * to settle.
 */
export async function gotoRoute(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    const root = document.getElementById("app") as
      | (HTMLElement & { __vue_app__?: { config: { globalProperties: Record<string, unknown> } } })
      | null;
    const router = root?.__vue_app__?.config.globalProperties["$router"] as
      | { push: (to: string) => Promise<unknown> }
      | undefined;
    if (!router) {
      throw new Error("vue-router not found on window — is the app mounted?");
    }
    return router.push(target);
  }, path);

  // Wait until vue-router has committed the navigation and the view
  // component has mounted. `path` compares exactly to the pathname.
  await page.waitForFunction(
    (target) => window.location.pathname === target,
    path,
    { timeout: 5_000 },
  );
}
