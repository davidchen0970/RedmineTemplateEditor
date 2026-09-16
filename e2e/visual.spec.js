import { test, expect } from "@playwright/test";

// The screenshots land in e2e/test-results so they can be eyeballed from the CI
// artifacts. They never assert on pixels -- looks are a human judgement.
test("captures light and dark full-page screenshots", async ({ page }) => {
	await test.step("open the editor and fold open the theme group", async () => {
		await page.goto("/");
		// The theme toggle lives in the folded 操作功能 group.
		await page.getByRole("button", { name: "操作功能" }).click();
	});
	await test.step("snapshot the light page", async () => {
		await page.screenshot({ path: "e2e/test-results/ui-light.png", fullPage: true });
	});
	await test.step("toggle to dark and snapshot", async () => {
		await page.click("#themeToggle");
		await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
		await page.screenshot({ path: "e2e/test-results/ui-dark.png", fullPage: true });
	});
});
