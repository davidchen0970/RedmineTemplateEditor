import { test, expect } from "@playwright/test";

// The porting preset starts with zero blocks, so the clone/delete flows seed one
// through the proven add-block dialog path before they count.
async function seedBlock(page, section) {
	await section.locator("[data-more-toggle]").first().click();
	await section.locator("[data-more]").first().locator("[data-add]").click();
	const dialog = page.locator("dialog#abDialog");
	await dialog.locator("#abTitle").fill("seed-block");
	await dialog.locator("#abMain textarea").fill("int x;");
	await dialog.locator("#abForm button[type=submit]").click();
	await expect(dialog).toBeHidden();
}

test("新增段落 adds a section", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const sections = page.locator("#sections .section");
	const before = await sections.count();
	await test.step("open the section menu and add a section", async () => {
		const section = sections.first();
		await section.locator("[data-more-toggle]").first().click();
		// 新增段落 opens a prompt dialog; it must be named and confirmed.
		await section.locator("[data-more]").first().locator("[data-add-section]").click();
		await expect(page.locator("[data-value]")).toBeVisible();
		await page.locator("[data-value]").fill(`e2e-section-${Date.now()}`);
		await page.locator("[data-confirm]").click();
		await expect(page.locator("[data-value]")).toBeHidden();
	});
	await test.step("expect one more section", async () => {
		await expect(sections).toHaveCount(before + 1);
	});
});

test("複製 duplicates a block in its section", async ({ page }) => {
	await test.step("open the editor and seed a block", async () => {
		await page.goto("/");
		await seedBlock(page, page.locator("#sections .section").first());
	});
	const blocks = page.locator("#sections [data-block]");
	await expect(blocks).toHaveCount(1);
	await test.step("open the block more menu and copy", async () => {
		await blocks.first().locator("[data-block-more]").click();
		await page.locator(".more-popup").getByRole("button", { name: /複製|Copy/ }).click();
	});
	await test.step("expect one more block", async () => {
		await expect(blocks).toHaveCount(2);
	});
});

test("刪除 removes a block after confirming", async ({ page }) => {
	await test.step("open the editor and seed a block", async () => {
		await page.goto("/");
		await seedBlock(page, page.locator("#sections .section").first());
	});
	const blocks = page.locator("#sections [data-block]");
	await expect(blocks).toHaveCount(1);
	await test.step("open the block more menu and delete", async () => {
		await blocks.first().locator("[data-block-more]").click();
		await page.locator(".more-popup").getByRole("button", { name: /刪除|Delete/ }).click();
	});
	await test.step("confirm the delete dialog", async () => {
		// The seed also creates #abDialog; "dialog.add-block-dialog" would match
		// two nodes. [data-confirm] exists only on the confirm dialog.
		await expect(page.locator("[data-confirm]")).toBeVisible();
		await page.locator("[data-confirm]").click();
	});
	await test.step("expect the block to disappear", async () => {
		await expect(blocks).toHaveCount(0);
	});
});

test("block 其他 menu rides its block while the page scrolls", async ({ page }) => {
	await test.step("open the editor, seed a block, and make the page scrollable", async () => {
		await page.goto("/");
		await seedBlock(page, page.locator("#sections .section").first());
		// A tall spacer guarantees a real document scroll so the re-anchor path
		// (window scroll listener in block-renderer.js) is actually exercised.
		await page.evaluate(() => {
			const spacer = document.createElement("div");
			spacer.style.height = "2400px";
			spacer.style.clear = "both";
			document.body.appendChild(spacer);
		});
	});
	await test.step("open the block more menu", async () => {
		await page.locator("#sections [data-block-more]").first().click();
		await expect(page.locator(".more-popup")).toBeVisible();
	});
	await test.step("scroll and expect the menu to keep tracking the toggle", async () => {
		const gap = () => page.locator(".more-popup").evaluate((el) => {
			const t = document.querySelector("[data-block-more]").getBoundingClientRect();
			return el.getBoundingClientRect().top - t.bottom;
		});
		await page.mouse.wheel(0, 300);
		// placeMore() re-anchors top = toggle.bottom + 4 on every scroll, so the
		// gap stays between 0 and 20px. Without re-anchoring the position:fixed
		// popup stays put and the gap grows by the scroll delta (~300px).
		await expect.poll(async () => {
			const g = await gap();
			return g >= 0 && g <= 20;
		}).toBe(true);
	});
});
