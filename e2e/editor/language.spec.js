import { test, expect } from "@playwright/test";

test("language toggle flips <html lang> and back", async ({ page }) => {
	await test.step("open the settings dialog from the more group", async () => {
		await page.goto("/");
		await page.locator('[data-header-action-group="more"] .header-action-group-toggle').click();
		await page.click("#settingsOpen");
		await expect(page.locator("#langToggle")).toBeVisible();
	});
	await test.step("toggle the language: <html lang> flips, then flips back", async () => {
		const before = await page.evaluate(() => document.documentElement.lang);
		await page.click("#langToggle");
		await expect
			.poll(async () => page.evaluate(() => document.documentElement.lang))
			.not.toBe(before);
		await page.click("#langToggle");
		await expect
			.poll(async () => page.evaluate(() => document.documentElement.lang))
			.toBe(before);
	});
});

test("output stats line reflects output.charLine in the active language", async ({ page }) => {
	await test.step("open the editor and type so the stats line updates", async () => {
		await page.goto("/");
		await page.fill("#title", "stats-check");
		// Out-of-preview view renders the stats line from t("output.charLine").
		// In the en default it uses chars · lines.
		await expect(page.locator("#stats")).toContainText("chars");
	});
	await test.step("switch to zh and the stats line adopts the zh units", async () => {
		await page.locator('[data-header-action-group="more"] .header-action-group-toggle').click();
		await page.click("#settingsOpen");
		await page.click("#langToggle");
		await expect(page.locator("#stats")).toContainText("字元");
	});
});
