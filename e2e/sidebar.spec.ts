import { test, expect } from "./fixtures";

// The 8 routes reachable from SideBar.vue (Settings has no sidebar
// entry — it's navigated to from elsewhere). Each entry is identified
// by the exact visible label rendered by the component.
const SIDEBAR_LINKS: { label: string; expectedPath: string }[] = [
  { label: "Dashboard", expectedPath: "/dashboard" },
  { label: "CLAUDE.md", expectedPath: "/instructions/claude-md" },
  { label: "Project overrides", expectedPath: "/instructions/overrides" },
  { label: "Browse skills", expectedPath: "/skills/browse" },
  { label: "Active here", expectedPath: "/skills/active" },
  { label: "Terminal", expectedPath: "/skills/terminal" },
  { label: "Built-in tools", expectedPath: "/tools/builtin" },
  { label: "MCP servers", expectedPath: "/tools/mcp" },
];

// Routes that render a badge pill in the sidebar. We don't assert
// specific counts (those depend on whatever's on the user's disk when
// the test runs) — just that the pill contains a number, proving the
// store populated.
const BADGE_LABELS = ["Project overrides", "Browse skills", "Active here", "MCP servers"];

test.describe("Sidebar", () => {
  test("every sidebar entry is rendered", async ({ page }) => {
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();

    for (const { label } of SIDEBAR_LINKS) {
      await expect(
        sidebar.getByRole("link", { name: label }),
        `Sidebar missing entry "${label}"`,
      ).toBeVisible();
    }
  });

  test("badge pills render numeric counts", async ({ page }) => {
    const sidebar = page.locator("aside").first();

    for (const label of BADGE_LABELS) {
      const link = sidebar.getByRole("link", { name: label });
      await expect(link).toBeVisible();
      // The badge is the last <span> child inside the link. We just
      // need its text to parse as a non-negative integer — the exact
      // number is FS-dependent and not something to hardcode. No `\b`
      // around the digits because textContent concatenates the label
      // and badge spans without whitespace ("Project overrides19").
      const linkText = (await link.textContent()) ?? "";
      const numberMatch = linkText.match(/(\d+)/);
      expect(
        numberMatch,
        `Sidebar entry "${label}" has no numeric badge. Full text: ${JSON.stringify(linkText)}`,
      ).not.toBeNull();
      expect(Number.parseInt(numberMatch![1]!, 10)).toBeGreaterThanOrEqual(0);
    }
  });

  test("clicking a sidebar entry navigates the router", async ({ page, consoleCollector }) => {
    const sidebar = page.locator("aside").first();

    for (const { label, expectedPath } of SIDEBAR_LINKS) {
      await sidebar.getByRole("link", { name: label }).click();
      await page.waitForFunction(
        (target) => window.location.pathname === target,
        expectedPath,
        { timeout: 5_000 },
      );
      expect(await page.evaluate(() => window.location.pathname)).toBe(expectedPath);
    }

    // Navigation-triggered console errors would otherwise silently pass
    // in route-by-route tests — here we catch any that crept in while
    // clicking through the whole tree.
    expect(consoleCollector.errors).toEqual([]);
  });
});
