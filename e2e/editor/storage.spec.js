import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		try {
			localStorage.setItem("redmine.locale", "zh");
		} catch {
			/* localStorage unavailable — navigator detection still applied */
		}
	});
});

test("storage New note registers a new document in the picker", async ({ page }) => {
	await test.step("open the editor, fold open the storage group", async () => {
		await page.goto("/");
		await page.locator('[data-header-action-group="notes"] .header-action-group-toggle').click();
		await page.fill("#title", "doc-one");
	});
	await test.step("confirm the new-document dialog", async () => {
		await page.click("#storageNew");
		const dialog = page.locator("dialog#ndDialog");
		await expect(dialog).toBeVisible();
		await dialog.locator("#ndConfirm").click();
	});
	await test.step("expect the picker to list an extra document", async () => {
		const options = await page.locator("#storageDocSelect option").count();
		expect(options).toBeGreaterThan(1);
	});
});

test("storage rename/delete updates the picker and guards the last document", async ({ page }) => {
	await test.step("fold open the notes group and rename the current document", async () => {
		await page.goto("/");
		await page.locator('[data-header-action-group="notes"] .header-action-group-toggle').click();
		await page.fill("#storageDocName", "備註一");
		await page.click("#storageRename");
		await expect(page.locator("#toast")).toContainText("名稱已更新");
	});
	await test.step("deleting the only remaining document is refused", async () => {
		await page.locator('[data-header-action-group="notes"] .header-action-group-toggle').click();
		await page.click("#storageDelete");
		const confirmDialog = page.locator("dialog[open]");
		await expect(confirmDialog).toBeVisible();
		await confirmDialog.locator("[data-confirm]").click();
		await expect(page.locator("#toast")).toContainText("至少需要保留一份文件");
	});
});
