import { test, expect } from "@playwright/test";

test("storage 新增儲存 registers a new document in the picker", async ({ page }) => {
	await test.step("open the editor, fold open the storage group", async () => {
		await page.goto("/");
		// The storage controls live in the folded 文件管理 group.
		await page.getByRole("button", { name: "文件管理" }).click();
		await page.fill("#title", "doc-one");
	});
	await test.step("confirm the new-document dialog", async () => {
		await page.click("#storageNew");
		// #storageNew only opens a dialog (see new-doc-dialog.js); the record is
		// created when 建立 (#ndConfirm) is pressed.
		const dialog = page.locator("dialog.add-block-dialog");
		await expect(dialog).toBeVisible();
		await dialog.locator("#ndConfirm").click();
	});
	await test.step("expect the picker to list an extra document", async () => {
		// 新增儲存 keeps the current document active; it merely adds an entry.
		const options = await page.locator("#storageDocSelect option").count();
		expect(options).toBeGreaterThan(1);
	});
});
