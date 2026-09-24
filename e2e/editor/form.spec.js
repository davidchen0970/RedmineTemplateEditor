import { test, expect } from "@playwright/test";

test("summary lines become conclusion bullets in the Textile", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	await test.step("fill the summary", async () => {
		await page.fill("#summary", "機器重開後HANG");
	});
	await test.step("expect a bullet under 結論", async () => {
		await expect(page.locator("#out")).toHaveValue(/結論/);
		await expect(page.locator("#out")).toHaveValue(/\* 機器重開後HANG/);
	});
});

test("status, change and ref flow into the Textile output", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	await test.step("pick a FAILED status", async () => {
		await page.selectOption("#status", "FAILED");
		await expect(page.locator("#out")).toHaveValue(/執行狀態/);
	});
	await test.step("fill the change goal and reference", async () => {
		await page.fill("#change", "改 BIOS 設定");
		await page.fill("#ref", "CR-0123");
	});
	await test.step("expect both echoed in the output", async () => {
		await expect(page.locator("#out")).toHaveValue(/修改內容/);
		await expect(page.locator("#out")).toHaveValue(/CR-0123/);
	});
});
