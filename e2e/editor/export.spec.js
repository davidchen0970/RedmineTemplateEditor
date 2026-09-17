import { test, expect } from "@playwright/test";

async function openExtraGroup(page) {
	// The download buttons now fold under the "file" group. Opening it is what makes
	// #txt, #json … clickable.
	await page.locator('[data-header-action-group="file"] .header-action-group-toggle').click();
}

test("downloads a .textile export", async ({ page }) => {
	await test.step("open the editor, set a title", async () => {
		await page.goto("/");
		await page.fill("#title", "download-me");
	});
	await test.step("fold open the extra group", async () => {
		await openExtraGroup(page);
		// Distinguish "the button is hidden" (group not really open) from "the
		// click happened but no download event fired".
		await expect(page.locator("#txt")).toBeVisible();
	});
	await test.step("trigger the textile download", async () => {
		const downloadPromise = page.waitForEvent("download");
		await page.click("#txt");
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toMatch(/\.textile$/);
	});
});

test("exports the current state as JSON", async ({ page }) => {
	await test.step("open the editor, set a title", async () => {
		await page.goto("/");
		await page.fill("#title", "json-export-me");
	});
	await test.step("fold open the extra group", async () => {
		await openExtraGroup(page);
		await expect(page.locator("#json")).toBeVisible();
	});
	await test.step("trigger the JSON download", async () => {
		const downloadPromise = page.waitForEvent("download");
		await page.click("#json");
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toMatch(/\.json$/);
	});
});
