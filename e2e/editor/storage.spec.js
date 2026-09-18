import { test, expect } from "@playwright/test";

// This spec asserts zh strings (rename toast 名稱已更新, delete guard
// 至少需要保留一份文件), so force the app into zh instead of letting
// detectLocale() fall back to navigator.language (en-US under Playwright).
test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		try {
			localStorage.setItem("redmine.locale", "zh");
		} catch {
			/* localStorage unavailable — navigator detection still applied */
		}
	});
});

test("storage 新增儲存 registers a new document in the picker", async ({ page }) => {
	await test.step("open the editor, fold open the storage group", async () => {
		await page.goto("/");
		// The storage controls now fold under the 文件清單 (notes) group.
		await page.locator('[data-header-action-group="notes"] .header-action-group-toggle').click();
		await page.fill("#title", "doc-one");
	});
	await test.step("confirm the new-document dialog", async () => {
		await page.click("#storageNew");
		// #storageNew only opens a dialog (see new-doc-dialog.js); the record is
		// created when 建立 (#ndConfirm) is pressed. Target the new-doc dialog by
		// id: the shared .add-block-dialog class is also on the always-mounted
		// settings dialog, so a class locator is ambiguous.
		const dialog = page.locator("dialog#ndDialog");
		await expect(dialog).toBeVisible();
		await dialog.locator("#ndConfirm").click();
	});
	await test.step("expect the picker to list an extra document", async () => {
		// 新增儲存 keeps the current document active; it merely adds an entry.
		const options = await page.locator("#storageDocSelect option").count();
		expect(options).toBeGreaterThan(1);
	});
});

test("storage 改名/刪除: rename updates the picker, deleting the last doc is guarded", async ({ page }) => {
	await test.step("fold open the notes group and rename the current document", async () => {
		await page.goto("/");
		await page.locator('[data-header-action-group="notes"] .header-action-group-toggle').click();
		await page.fill("#storageDocName", "備註一");
		await page.click("#storageRename");
		await expect(page.locator("#toast")).toContainText("名稱已更新");
	});
	await test.step("deleting the only remaining document is refused", async () => {
		// A storage action closes its 文件清單 group (mobile-header collapse), so
		// reopen it before the delete button can be hit.
		await page.locator('[data-header-action-group="notes"] .header-action-group-toggle').click();
		// Delete is now a custom confirmation dialog, not a native confirm() box.
		await page.click("#storageDelete");
		const confirmDialog = page.locator("dialog[open]");
		await expect(confirmDialog).toBeVisible();
		await confirmDialog.locator("[data-confirm]").click();
		await expect(page.locator("#toast")).toContainText("至少需要保留一份文件");
	});
});
