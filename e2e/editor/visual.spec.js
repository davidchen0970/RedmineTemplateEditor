import { test, expect } from "@playwright/test";

test("captures light and dark full-page screenshots", async ({ page }) => {
	await test.step("open the editor and fold open the settings", async () => {
		await page.goto("/");
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
