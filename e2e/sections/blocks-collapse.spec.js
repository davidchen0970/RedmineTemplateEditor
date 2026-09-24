import { test, expect } from "@playwright/test";

async function seedBlock(page, section) {
	await section.locator("[data-more-toggle]").first().click();
	await section.locator("[data-more]").first().locator("[data-add]").click();
	const dialog = page.locator("dialog#abDialog");
	await dialog.locator("#abTitle").fill(`block-collapse-${Date.now()}`);
	await dialog.locator("#abForm button[type=submit]").click();
	await expect(dialog).toBeHidden();
}

test("collapse all blocks collapses every block in the section", async ({ page }) => {
	await test.step("open the editor and seed two blocks", async () => {
		await page.goto("/");
		const section = page.locator("#sections .section").first();
		await seedBlock(page, section);
		await seedBlock(page, section);
		await expect(page.locator("#sections [data-block]")).toHaveCount(2);
	});

	await test.step("expand every seeded block to a known open state", async () => {
		const count = await page.locator("#sections [data-block]").count();
		for (let i = 0; i < count; i++) {
			const block = page.locator("#sections [data-block]").nth(i);
			const toggle = block.locator("[data-block-toggle]");
			if ((await toggle.getAttribute("aria-expanded")) !== "true") {
				await toggle.click();
			}
			await expect(block).not.toHaveClass(/is-collapsed/);
			await expect(block.locator("[data-block-toggle]")).toHaveAttribute("aria-expanded", "true");
		}
	});

	await test.step("open the section menu and run 全部收闔區塊", async () => {
		const section = page.locator("#sections .section").first();
		await section.locator("[data-more-toggle]").first().click();
		await section.locator("[data-more]").first().locator("[data-collapse-block]").click();
	});

	await test.step("every block is now collapsed", async () => {
		const blocks = page.locator("#sections [data-block]");
		const count = await blocks.count();
		for (let i = 0; i < count; i++) {
			const toggle = blocks.nth(i).locator("[data-block-toggle]");
			await expect(blocks.nth(i)).toHaveClass(/is-collapsed/);
			await expect(toggle).toHaveAttribute("aria-expanded", "false");
			await expect(blocks.nth(i).locator("[data-block-collapsible]")).toBeHidden();
		}
	});
});

test("single block expand state survives reload", async ({ page }) => {
	await test.step("open the editor and seed one block", async () => {
		await page.goto("/");
		await seedBlock(page, page.locator("#sections .section").first());
		await expect(page.locator("#sections [data-block]")).toHaveCount(1);
	});

	const block = page.locator("#sections [data-block]").first();

	await test.step("collapse then expand so the persisted state is recorded", async () => {
		const toggle = block.locator("[data-block-toggle]");
		if ((await toggle.getAttribute("aria-expanded")) === "true") {
			await toggle.click();
			await expect(toggle).toHaveAttribute("aria-expanded", "false");
		}
		await toggle.click();
		await expect(toggle).toHaveAttribute("aria-expanded", "true");
		await expect(block.locator("[data-block-collapsible]")).toBeVisible();
	});

	await test.step("reload and expect the block still expanded", async () => {
		await page.reload();
		const afterToggle = page.locator("#sections [data-block] [data-block-toggle]").first();
		await expect(afterToggle).toHaveAttribute("aria-expanded", "true");
		await expect(
			page.locator("#sections [data-block] [data-block-collapsible]").first(),
		).toBeVisible();
	});
});
