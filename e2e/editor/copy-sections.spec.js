import { test, expect } from "@playwright/test";

test("複製段落 opens the section picker and cancels with a toast", async ({ page }) => {
	await test.step("open the editor and the file group, hit #copySections", async () => {
		await page.goto("/");
		await page.locator('[data-header-action-group="file"] .header-action-group-toggle').click();
		await page.click("#copySections");
		const box = page.locator("dialog[open]");
		await expect(box).toBeVisible();
	});
	await test.step("the picker lists the porting preset sections", async () => {
		await expect(page.locator("dialog[open] [data-list] label")).toHaveCount(3);
	});
	await test.step("cancelling settles with a toast", async () => {
		await page.locator("dialog[open] [data-cancel]").click();
		await expect(page.locator("#toast")).toContainText("已取消複製段落");
	});
});

test("複製段落 backdrop click dismisses without copying", async ({ page }) => {
	await test.step("open the picker", async () => {
		await page.goto("/");
		await page.locator('[data-header-action-group="file"] .header-action-group-toggle').click();
		await page.click("#copySections");
		await expect(page.locator("dialog[open]")).toBeVisible();
	});
	await test.step("a click on the backdrop closes it like a cancel", async () => {
		// A native <dialog> backdrop can't be targeted by locator; the corner of
		// the viewport is outside the centered box, on the ::backdrop.
		await page.mouse.click(6, 6);
		await expect(page.locator("dialog[open]")).toHaveCount(0);
		await expect(page.locator("#toast")).toContainText("已取消複製段落");
	});
});
