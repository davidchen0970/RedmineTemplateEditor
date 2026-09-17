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
