import { test, expect } from "@playwright/test";

test("storage 新增儲存 starts a blank document", async ({ page }) => {
	await test.step("open the editor, fold open the storage group", async () => {
		await page.goto("/");
		// The storage controls live in the folded 文件管理 group.
		await page.getByRole("button", { name: "文件管理" }).click();
		await page.fill("#title", "doc-one");
	});
	await test.step("start a new stored document", async () => {
		await page.click("#storageNew");
	});
	await test.step("expect a blank active document plus an extra picker entry", async () => {
		// A fresh (blank) document becomes active, so the title field clears.
		await expect(page.locator("#title")).not.toHaveValue("doc-one");
		// And a second named document appears in the picker.
		const options = await page.locator("#storageDocSelect option").count();
		expect(options).toBeGreaterThan(1);
	});
});
