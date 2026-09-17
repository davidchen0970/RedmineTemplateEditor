import { test, expect } from "@playwright/test";

// The screenshots land in e2e/test-results so they can be eyeballed from the CI
// artifacts. They never assert on pixels -- looks are a human judgement.
test("captures light and dark full-page screenshots", async ({ page }) => {
	await test.step("open the editor and fold open the settings", async () => {
		await page.goto("/");
		// The theme toggle now lives in the 設定 dialog; open the 更多 group so the
		// light snapshot matches how the page renders with a group unfolded.
		await page.locator('[data-header-action-group="more"] .header-action-group-toggle').click();
	});
	await test.step("snapshot the light page", async () => {
		await page.screenshot({ path: "e2e/test-results/ui-light.png", fullPage: true });
	});
	await test.step("toggle to dark and snapshot", async () => {
		await page.click("#settingsOpen");
		await page.click("#themeToggle");
		await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
		await page.screenshot({ path: "e2e/test-results/ui-dark.png", fullPage: true });
	});
});
