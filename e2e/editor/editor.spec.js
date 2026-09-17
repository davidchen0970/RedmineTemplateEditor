import { test, expect } from "@playwright/test";

test("typing the title updates the Textile output", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const title = `端到端-${Date.now()}`;
	await test.step("type a unique title", () => page.fill("#title", title));
	await test.step("expect the Textile pane to echo h2. title", async () => {
		await expect(page.locator("#out")).toHaveValue(new RegExp(`h2\\. ${title}`));
	});
});

test("switches between Textile, preview and JSON views", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	await test.step("switch to preview", async () => {
		await page.click("#previewbtn");
		await expect(page.locator("#preview")).toBeVisible();
		await expect(page.locator("#out")).toBeHidden();
	});
	await test.step("switch to JSON and parse the state", async () => {
		await page.click("#statebtn");
		await expect(page.locator("#out")).toBeVisible();
		const jsonText = await page.inputValue("#out");
		const parsed = JSON.parse(jsonText);
		expect(Array.isArray(parsed.sections)).toBe(true);
	});
});

test("theme toggle flips body back and forth light/dark", async ({ page }) => {
	await test.step("open the editor in forced light", async () => {
		await page.emulateMedia({ colorScheme: "light" });
		await page.goto("/");
	});
	await test.step("start light", async () => {
		await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
	});
	await test.step("toggle to dark", async () => {
		// The toolbar buttons live in the folded 操作功能 group; open it. Clicking
		// a panel button auto-collapses the group again.
		await page.getByRole("button", { name: "操作功能" }).click();
		await page.click("#themeToggle");
		await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
	});
	await test.step("toggle back to light", async () => {
		await page.getByRole("button", { name: "操作功能" }).click();
		await page.click("#themeToggle");
		await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
	});
});

test("adds an implementation block from the 其他 menu and dialog", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const section = page.locator("#sections .section").first();
	await test.step("open the add-block dialog", async () => {
		await section.locator("[data-more-toggle]").first().click();
		await section.locator("[data-more]").first().locator("[data-add]").click();
		const dialog = page.locator("dialog#abDialog");
		await expect(dialog).toBeVisible();
		// Implementation fields: a 語言 input and a 內容 textarea.
		await expect(dialog.locator("#abMain input")).toBeVisible();
		await expect(dialog.locator("#abMain textarea")).toBeVisible();
		// The less common fields fold behind the 其他 collapsible.
		await expect(dialog.locator("#abExtraWrap")).toBeVisible();
	});
	await test.step("fill the implementation and submit", async () => {
		const dialog = page.locator("dialog#abDialog");
		await dialog.locator("#abTitle").fill("e2e-block");
		await dialog.locator("#abMain textarea").fill("echo ci-playwright");
	});
	await test.step("expect a new block to appear", async () => {
		const dialog = page.locator("dialog#abDialog");
		const before = await section.locator("[data-blocks] .block").count();
		await test.step("submit the dialog", async () => {
			await dialog.locator("#abForm button[type=submit]").click();
			await expect(dialog).toBeHidden();
		});
		const after = await section.locator("[data-blocks] .block").count();
		expect(after).toBeGreaterThan(before);
	});
});

test("plainText blocks disable the title field", async ({ page }) => {
	await test.step("open the add-block dialog", async () => {
		await page.goto("/");
		const section = page.locator("#sections .section").first();
		await section.locator("[data-more-toggle]").first().click();
		await section.locator("[data-more]").first().locator("[data-add]").click();
	});
	await test.step("pick plainText and expect the title disabled", async () => {
		const dialog = page.locator("dialog#abDialog");
		await dialog.locator("#abTypes").getByText("純文字", { exact: true }).click();
		await expect(dialog.locator("#abTitle")).toBeDisabled();
	});
});

test("diff blocks expose the diff/patch upload field", async ({ page }) => {
	await test.step("open the add-block dialog", async () => {
		await page.goto("/");
		const section = page.locator("#sections .section").first();
		await section.locator("[data-more-toggle]").first().click();
		await section.locator("[data-more]").first().locator("[data-add]").click();
	});
	await test.step("pick a diff block and expect the upload field", async () => {
		const dialog = page.locator("dialog#abDialog");
		await dialog.locator("#abTypes").getByText("程式碼差異", { exact: true }).click();
		await expect(dialog.locator('[data-ab="diffFile"]')).toBeVisible();
	});
});
