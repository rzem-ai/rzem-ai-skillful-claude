import { test, expect, gotoRoute } from "./fixtures";

// One row per route declared in src/router/index.ts. `landmark` is a
// short substring we expect to see rendered once the view has mounted —
// usually its h1 text. Keeping this next to the route table makes it
// cheap to add/remove routes: the table stays the source of truth.
const ROUTES: { path: string; landmark: string }[] = [
  { path: "/dashboard", landmark: "Claude" },
  { path: "/instructions/claude-md", landmark: "Instructions" },
  { path: "/instructions/overrides", landmark: "Project overrides" },
  { path: "/skills/browse", landmark: "Browse skills" },
  { path: "/skills/active", landmark: "Active here" },
  { path: "/skills/terminal", landmark: "Skills terminal" },
  { path: "/tools/builtin", landmark: "Built-in tools" },
  { path: "/tools/mcp", landmark: "MCP servers" },
  { path: "/settings", landmark: "Settings" },
];

test.describe("Smoke: app boot", () => {
  test("main window opens with the Skillful Claude title", async ({ electronApp, page }) => {
    expect(await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return { title: win?.getTitle() ?? null, isVisible: win?.isVisible() ?? false };
    })).toMatchObject({ title: "Skillful Claude" });

    // The shell always renders the TopBar with the brand wordmark.
    await expect(page.getByText("Skillful Claude").first()).toBeVisible();
  });

  test("no fatal console errors at boot", async ({ page, consoleCollector }) => {
    // Give any deferred boot-time listeners a chance to fire before we
    // assert the collector is empty.
    await page.waitForTimeout(500);
    expect(consoleCollector.errors, `Boot-time console errors: ${JSON.stringify(consoleCollector.errors, null, 2)}`).toEqual([]);
  });
});

test.describe("Smoke: every route renders", () => {
  for (const { path, landmark } of ROUTES) {
    test(`route ${path} renders without fatal errors`, async ({ page, consoleCollector }) => {
      await gotoRoute(page, path);

      // 1. The URL committed. (gotoRoute already waited for this, but an
      //    explicit expect gives a clearer failure message.)
      expect(await page.evaluate(() => window.location.pathname)).toBe(path);

      // 2. The main content area has *something* visible — rules out the
      //    "white screen because the view threw on mount" regression.
      const main = page.locator("main");
      await expect(main).toBeVisible();
      const bodyText = (await main.textContent())?.trim() ?? "";
      expect(bodyText.length, `Route ${path} rendered an empty <main>`).toBeGreaterThan(0);

      // 3. The landmark copy for the route is present. This confirms
      //    the *correct* view mounted, not just any view.
      await expect(main.getByText(landmark, { exact: false }).first()).toBeVisible();

      // 4. No console errors fired while navigating into this route.
      //    We snapshot the count per route so an earlier route's error
      //    can't mask a later one.
      expect(
        consoleCollector.errors,
        `Console errors on ${path}: ${JSON.stringify(consoleCollector.errors, null, 2)}`,
      ).toEqual([]);
    });
  }
});
