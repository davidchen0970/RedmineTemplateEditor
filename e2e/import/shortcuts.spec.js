import { test, expect } from "@playwright/test";

test("shortcut help dialog lists every registered shortcut", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	await test.step("open the 更多 group, the settings dialog, and the shortcut dialog", async () => {
		// #shortcutHelp now lives as a row inside the 設定 dialog (which itself is
		// opened through #settingsOpen in the 更多 group).
		await page.locator('[data-header-action-group="more"] .header-action-group-toggle').click();
		await page.click("#settingsOpen");
		await page.click("#shortcutHelp");
		const dialog = page.locator("dialog#shortcutDialog");
		await expect(dialog).toBeVisible();
	});
	await test.step("expect 3 shortcut rows and a modifier hint", async () => {
		const dialog = page.locator("dialog#shortcutDialog");
		await expect(dialog.locator(".shortcut-row")).toHaveCount(3);
		await expect(dialog.locator(".shortcut-note")).toContainText("Ctrl");
	});
	await test.step("close the dialog", async () => {
		await page.click("#shortcutClose");
		await expect(page.locator("dialog#shortcutDialog")).toBeHidden();
	});
});

test("Ctrl+Shift+C copies the Textile and raises the copy toast", async ({ page, browserName }) => {
	// Headless Firefox/WebKit do not reliably grant clipboard-write, so the copy
	// flows are Chromium-only; the copy toast only fires after a successful write.
	test.skip(browserName === "firefox" || browserName === "webkit", "clipboard grant is unreliable for firefox/webkit");
	await test.step("open the editor and grant clipboard write", async () => {
		await page.goto("/");
		// navigator.clipboard is only usable once Chromium/Firefox grant it.
		await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
		await page.fill("#title", `快捷-${Date.now()}`);
	});
	await test.step("press the Textile-copy shortcut", async () => {
		await page.keyboard.press("Control+Shift+C");
	});
	await test.step("expect the copy toast", async () => {
		// The toast is i18n-localized ("已複製 Textile" / "Textile copied"); assert
		// the shared token rather than a pinned language.
		await expect(page.locator("#toast")).toContainText(/Textile/);
	});
});

test("#copy also downloads a JSON snapshot", async ({ page, browserName }) => {
	test.skip(browserName === "firefox" || browserName === "webkit", "clipboard grant is unreliable for firefox/webkit");
	await test.step("open the editor and grant clipboard write", async () => {
		await page.goto("/");
		await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
		await page.fill("#title", `copy-${Date.now()}`);
	});
	await test.step("fold open the File group", async () => {
		await page.locator('[data-header-action-group="file"] .header-action-group-toggle').click();
		await expect(page.locator("#copy")).toBeVisible();
	});
	await test.step("trigger the copy button", async () => {
		const downloadPromise = page.waitForEvent("download");
		await page.click("#copy");
		expect((await downloadPromise).suggestedFilename()).toMatch(/\.json$/);
	});
});
