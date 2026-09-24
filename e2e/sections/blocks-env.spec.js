import { test, expect } from "@playwright/test";

// The porting preset starts with zero blocks, so the level test seeds blocks
// through the proven add-block dialog path (same as blocks.spec.js).
// Newly added blocks are rendered expanded (section-renderer.js renderAll with
// openBlockId), so the last seeded block's level input is the visible one.
async function seedBlock(page, section) {
	await section.locator("[data-more-toggle]").first().click();
	await section.locator("[data-more]").first().locator("[data-add]").click();
	const dialog = page.locator("dialog#abDialog");
	await dialog.locator("#abTitle").fill("seed-block");
	await dialog.locator("#abMain textarea").fill("int x;");
	await dialog.locator("#abForm button[type=submit]").click();
	await expect(dialog).toBeHidden();
}

test("block level is clamped to the previous block level plus one", async ({ page }) => {
	await test.step("open the editor and seed two blocks", async () => {
		await page.goto("/");
		const section = page.locator("#sections .section").first();
		await seedBlock(page, section);
		await seedBlock(page, section);
		await expect(page.locator("#sections [data-block]")).toHaveCount(2);
	});
	await test.step("fill the second block's level input with a huge number", async () => {
		// getMaxBlockLevel(index 1) = normalize(first.level) + 1 = 2. The
		// oninput handler clamps the typed value to that max and re-renders.
		// Assumption: the second block is the open one (its ancestor covers the
		// input); this test intentionally relies on blocks.spec's add flow where
		// the just-seeded block stays expanded.
		const secondLevel = page
			.locator("#sections [data-block] [data-blevel]")
			.nth(1);
		await secondLevel.fill("99");
	});
	await test.step("expect the value to be clamped to first.level + 1", async () => {
		// value attribute is what the assertion reads, per block-view.js the
		// input carries max/value; toHaveValue works regardless of being hidden
		// or shown after the re-render.
		await expect(
			page.locator("#sections [data-block] [data-blevel]").nth(1),
		).toHaveValue("2");
	});
});

test("environment toggle includes values in output only when enabled", async ({ page }) => {
	await test.step("open the editor and expand the 測試環境 panel", async () => {
		await page.goto("/");
		// Assumption: section-env starts collapsed (index.html) and clicking the
		// [data-collapse-target="section-env"] title button once expands the body
		// (main.js collapse handler toggles .collapsed off on first click).
		await page.locator('[data-collapse-target="section-env"]').click();
		await expect(page.locator("#env")).toBeVisible();
	});

	await test.step("add a custom environment item and fill its value", async () => {
		// #envAddItem creates {label:"自訂項目", value:"", enabled:true, custom:true}
		// (form-renderer bindEnvHeader) -> it renders an enabled env card.
		await page.locator("#envAddItem").click();
		const card = page.locator("#env [data-env-id]");
		await expect(card).toHaveCount(1);
		// The card's body holds the value textarea (form-renderer renderEnv).
		await card.locator("textarea").fill("7");
	});
	await test.step("expect the env value to be in #out while enabled", async () => {
		// Assumption: #envEnabled starts checked (environmentEnabled true). The
		// generator emits a single-line env as "* <label>: <value>"
		// (generator.js:89). The label is locale-dependent (customDefault is
		// 自訂項目 / Custom Item), so keep the assertion language-neutral.
		await expect(page.locator("#out")).toHaveValue(/\* .+: 7/);
	});

	await test.step("uncheck #envEnabled", async () => {
		await page.locator("#envEnabled").uncheck();
	});
	await test.step("expect #out to drop the environment", async () => {
		// Assumption: unchecking flips environmentEnabled to false, and the
		// generator's `environmentEnabled !== false` guard drops env lines.
		await expect(page.locator("#out")).not.toHaveValue(/: 7/);
	});
});

test("environment delete removes the environment from output after confirmation", async ({ page }) => {
	await test.step("add a custom environment value", async () => {
		await page.goto("/");
		await page.click("#envAddItem");
		const card = page.locator("#env [data-env-id]");
		await expect(card).toHaveCount(1);
		await card.locator("textarea").fill("7");
		await expect(page.locator("#out")).toHaveValue(/\* .+: 7/);
	});
	await test.step("hit #envDelete and confirm", async () => {
		await page.click("#envDelete");
		const box = page.locator("dialog[open]");
		await expect(box).toBeVisible();
		await box.locator("[data-confirm]").click();
	});
	await test.step("expect the environment to drop from #out", async () => {
		await expect(page.locator("#envEnabled")).not.toBeChecked();
		await expect(page.locator("#out")).not.toHaveValue(/: 7/);
	});
});
