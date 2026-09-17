import { test, expect } from "@playwright/test";

test("app shell loads the editor", async ({ page }) => {
	await test.step("load the shell", () => page.goto("/"));
	await test.step("expect the Redmine page title", async () => {
		await expect(page).toHaveTitle(/Redmine Textile/);
	});
	await test.step("expect section cards", async () => {
		// The porting preset renders section cards in the side form.
		await expect(page.locator("#sections .section").first()).toBeVisible();
	});
	await test.step("expect the title and Textile output", async () => {
		await expect(page.locator("#title")).toBeVisible();
		await expect(page.locator("#out")).toBeVisible();
	});
});
