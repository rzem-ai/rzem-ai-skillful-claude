import { test, expect, gotoRoute } from "./fixtures";

// Regression test for the "global CLAUDE.md doesn't exist on disk"
// wiring bug.
//
// Original failure mode (now fixed): when `~/.claude/CLAUDE.md` was
// missing the view rendered the h1 "Global instructions" *and* the
// body message "No CLAUDE.md selected" alongside an "Empty" file card,
// a contradictory state that made the user think they had a file they
// didn't. The fix introduced a dedicated empty-state view, gated on
// the `claude-md-missing-global` testid, that explains the situation.
//
// This test asserts the fix is in place. If the user has a real
// global CLAUDE.md the test skips automatically (the empty state
// isn't reachable). Don't loosen the assertions — the whole point is
// to catch a regression of the wiring bug.

test.describe("CLAUDE.md empty state coherence", () => {
  test("missing global CLAUDE.md shows a coherent empty state", async ({ page }) => {
    await gotoRoute(page, "/instructions/claude-md");

    const main = page.locator("main").first();
    await expect(main).toBeVisible();

    // The renderer kicks off `loadAll()` on mount; the AppShell shows a
    // spinner until it resolves. Wait for the spinner to clear so we
    // know the store is populated before we check for the empty state.
    await page
      .locator(".animate-spin")
      .waitFor({ state: "detached", timeout: 5_000 })
      .catch(() => {
        /* spinner may never have appeared on a fast load — that's fine */
      });

    // Gate: only run when the user's environment is actually in the
    // missing-global scenario. The dedicated empty-state container
    // (added by the fix) is the source of truth. Use a real wait
    // instead of an instantaneous isVisible() so we don't race the
    // route transition.
    const emptyState = page.getByTestId("claude-md-missing-global");
    const inMissingScenario = await emptyState
      .waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    test.skip(
      !inMissingScenario,
      "Skipped: user has a global CLAUDE.md on disk, empty-state isn't reachable in this environment.",
    );

    // ── Coherence assertions ────────────────────────────────────────
    // 1. The empty-state body must explain *what* is missing — not
    //    the generic "No CLAUDE.md selected" copy that contradicted
    //    the header.
    await expect(emptyState).toContainText(/doesn'?t exist yet/i);
    await expect(emptyState).toContainText("~/.claude/CLAUDE.md");

    // 2. The contradictory body copy from the original bug must NOT
    //    be visible alongside the empty state.
    await expect(
      main.getByText("No CLAUDE.md selected", { exact: false }),
    ).toHaveCount(0);

    // 3. The file-state pill must not lie. In the bug it said "Empty"
    //    while the header asserted a live file. The fix relabels the
    //    pill "Missing" so the state is internally consistent.
    const sidePanelText = (await main.textContent()) ?? "";
    expect(
      sidePanelText.includes("Synced"),
      "File card claims 'Synced' while the empty state is showing.",
    ).toBe(false);
    expect(
      sidePanelText.includes("Missing"),
      "File card should explicitly label the missing state as 'Missing'.",
    ).toBe(true);
  });

  test("populated global CLAUDE.md shows a coherent loaded state", async ({ page }) => {
    await gotoRoute(page, "/instructions/claude-md");

    const main = page.locator("main").first();
    await expect(main).toBeVisible();

    // Wait for the loading spinner to drain so the store is populated.
    await page
      .locator(".animate-spin")
      .waitFor({ state: "detached", timeout: 5_000 })
      .catch(() => { /* may have already drained */ });

    // Skip when the user is in the missing-global scenario — the other
    // test in this file covers it. We assert the inverse here.
    const emptyState = page.getByTestId("claude-md-missing-global");
    const inMissingScenario = await emptyState
      .waitFor({ state: "visible", timeout: 1_500 })
      .then(() => true)
      .catch(() => false);

    test.skip(
      inMissingScenario,
      "Skipped: no global CLAUDE.md on disk in this environment — covered by the empty-state test.",
    );

    // Header reflects scope, body shows real file metadata, no
    // "Empty"/"Missing" badge, no contradictory placeholder text.
    const h1Text = (await main.locator("h1").first().textContent())?.trim() ?? "";
    expect(h1Text).toBe("Global instructions");

    const mainText = (await main.textContent()) ?? "";
    expect(mainText).not.toContain("No CLAUDE.md selected");
    expect(mainText).not.toContain("Missing");

    // The state pill is one of the synced/unsaved variants — never
    // "Empty" when a real file is on disk.
    const hasSyncedOrUnsaved =
      mainText.includes("Synced") || mainText.includes("Unsaved");
    expect(
      hasSyncedOrUnsaved,
      "Loaded file should show a Synced or Unsaved state pill.",
    ).toBe(true);

    // The "Inherited by N projects" pill should be present and N must
    // parse as a non-negative integer (it's filesystem-dependent).
    const inheritedMatch = mainText.match(/Inherited by (\d+) project/);
    expect(
      inheritedMatch,
      "Inherited-by pill missing when global CLAUDE.md is loaded.",
    ).not.toBeNull();
    expect(Number.parseInt(inheritedMatch![1]!, 10)).toBeGreaterThanOrEqual(0);
  });
});
