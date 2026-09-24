import { test, expect } from "@playwright/test";

// Block-level operations (up/down move, type switch, add-content), each grounded
// in src/ui/editor/block-renderer.js:
//   [data-bup]/[data-bdown] -> move() (block-renderer.js:140-141), which does
//        slideReorder() then renderAll(); the reorder lands in #out, so assert
//        order via toHaveValue(RegExp) whose retries absorb the animation.
//   [data-btype]             -> onchange (block-renderer.js:122-129):
//        block.type=value; applyDefaults(block); changed(); renderAll({openBlockId}).
//        Switching to implementation re-renders block-view.js:58-70 so the
//        work-path field ([data-work-fields]) appears again.
//   [data-add-content]       -> onclick (block-renderer.js:142-146) pushes one
//        more content slot; fill the new [data-cont-index=N] textarea
//        (block-view.js:146) so generator.js:209-217 echoes a second <pre>.
// The porting preset ships zero blocks and section.enabled=false, so every test
// seeds a block through the add-block dialog and checks [data-se] first.
async function seedBlock(page, section, { title = "seed", content = "int x;" } = {}) {
	await section.locator("[data-more-toggle]").first().click();
	await section.locator("[data-more]").first().locator("[data-add]").click();
	const dialog = page.locator("dialog#abDialog");
	await dialog.locator("#abTitle").fill(title);
	await dialog.locator("#abMain textarea").fill(content);
	await dialog.locator("#abForm button[type=submit]").click();
	await expect(dialog).toBeHidden();
}

// Porting renders only enabled sections (generator.js:134-143), so a block only
// reaches #out once its section checkbox is checked.
async function enableFirstSection(page) {
	await page.locator("#sections .section").first().locator("[data-se]").first().check();
}

test("block move up/down swaps block order in the section", async ({ page }) => {
	await test.step("open the editor and seed two distinguishable blocks", async () => {
		await page.goto("/");
		await seedBlock(page, page.locator("#sections .section").first(), { content: "int a;" });
		await seedBlock(page, page.locator("#sections .section").first(), { content: "int b;" });
		await enableFirstSection(page);
	});
	const blocks = page.locator("#sections [data-block]");
	await test.step("seed both implementation blocks in order", async () => {
		await expect(blocks).toHaveCount(2);
	});
	await test.step("b then bdown: a is emitted before b initially", async () => {
		await expect(page.locator("#out")).toHaveValue(/int a;[\s\S]*int b;/);
	});
	await test.step("move the first block down one slot", async () => {
		await blocks.first().locator("[data-bdown]").click();
	});
	await test.step("the Textile output swaps to b before a", async () => {
		// move() swaps then renderAll; toHaveValue retries until #out settles.
		await expect(page.locator("#out")).toHaveValue(/int b;[\s\S]*int a;/);
	});
});

test("switching block type to implementation re-applies defaults and work path", async ({ page }) => {
	await test.step("open the editor and seed one block in an enabled section", async () => {
		await page.goto("/");
		await seedBlock(page, page.locator("#sections .section").first(), { content: "int x;" });
		await enableFirstSection(page);
	});
	const block = page.locator("#sections [data-block]").first();
	await test.step("switch away to text: work-path field disappears", async () => {
		await block.locator("[data-btype]").selectOption("text");
		// implementation-only field (block-view.js:58-70) is not re-rendered for text.
		await expect(block.locator("[data-work]")).toHaveCount(0);
	});
	await test.step("switch back to implementation: work path field reappears", async () => {
		await block.locator("[data-btype]").selectOption("implementation");
		await expect(block.locator("[data-work-fields]")).toBeVisible();
	});
	await test.step("applyDefaults + renderAll put the work path into #out", async () => {
		// "{{collapse(work path)" … "(docker)$ pwd" (generator.js:197-207).
		await expect(page.locator("#out")).toHaveValue(/\(docker\)\$ pwd/);
	});
});

test("add content pushes a second content segment into the block output", async ({ page }) => {
	await test.step("open the editor and seed one block in an enabled section", async () => {
		await page.goto("/");
		await seedBlock(page, page.locator("#sections .section").first(), { content: "int x;" });
		await enableFirstSection(page);
	});
	const block = page.locator("#sections [data-block]").first();
	await test.step("expand the freshly seeded block body", async () => {
		// enableFirstSection re-renders without openBlockId, which collapses the
		// new block (block-view.js:106-118 setOpen open=false), hiding the
		// [data-add-content] button behind the block-summary. Open it first and
		// assert via the toggle's aria so the click below stays actionnable.
		const toggle = block.locator("[data-block-toggle]");
		if ((await toggle.getAttribute("aria-expanded")) !== "true") {
			await toggle.click();
		}
		await expect(toggle).toHaveAttribute("aria-expanded", "true");
	});
	await test.step("add a second content slot", async () => {
		await block.locator("[data-add-content]").click();
		// implementation + add-content push {content:"",lang} (block-renderer.js:143);
		// renderContents re-renders both textareas (block-view.js:131-148).
		await expect(block.locator("[data-cont-index]")).toHaveCount(2);
	});
	await test.step("fill the new slot so it survives the empty-content filter", async () => {
		// generator.js:196 filters empty contents, so fill slot #2 before checking #out.
		await block.locator('[data-cont-index="1"]').fill("int y;");
	});
	await test.step("the Textile output now carries two code segments", async () => {
		await expect(page.locator("#out")).toHaveValue(/int x;[\s\S]*int y;/);
	});
});
