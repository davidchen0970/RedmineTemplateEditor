import { test, expect } from "@playwright/test";

// Markup / behaviour facts (read from source, not guessed):
//  - Section menu collapses a whole section's blocks with `[data-collapse-block]`
//    (button: section-renderer.js:130, bound at :194) -> collapseSectionBlocks()
//    (section-renderer.js:97-106): for every block.id it writes
//    ui.collapsed.blocks[block.id]=true then changed() (renderAll), so the menu
//    action persists each block as collapsed.
//  - A single block's collapse marker is the header toggle button
//    `[data-block-toggle]` (block-view.js:77). block-view.js:106-110 setOpen()
//    drives three collapsed cues together:
//        element.classList.toggle("is-collapsed", !nextOpen)      -> block has "is-collapsed"
//        [data-block-collapsible].hidden = !nextOpen
//        [data-block-toggle].setAttribute("aria-expanded", ...)   -> "true"|"false"
//  - Default for blocks is COLLAPSED: section-renderer.js:162
//        isCollapsed(getState(), "blocks", block.id, true)
//    so any block starts open = false. The single-block toggle onToggle writes
//    ui.collapsed.blocks[id] = !nextOpen (section-renderer.js:165-169),
//    changed() -> save -> localStorage (storage.js:112-117).
//  - Because collapsed is the default, the reload proof (like collapse-reset.spec.js)
//    toggles a block EXPANDED, then reload: if it stays expanded the ui.collapsed.blocks
//    entry really reached localStorage.
//  - The porting preset has zero blocks, and blocks render regardless of
//    section.enabled (collapsing is a DOM/rendering concern, not an output one),
//    so each test seeds one via the proven
//    add-block dialog (path copied from e2e/blocks.spec.js seedBlock).

// Seed one block through the "新增區塊" dialog, matching e2e/blocks.spec.js.
async function seedBlock(page, section) {
	await section.locator("[data-more-toggle]").first().click();
	await section.locator("[data-more]").first().locator("[data-add]").click();
	const dialog = page.locator("dialog#abDialog");
	await dialog.locator("#abTitle").fill(`block-collapse-${Date.now()}`);
	await dialog.locator("#abForm button[type=submit]").click();
	await expect(dialog).toBeHidden();
}

test("全部收闔區塊 collapses every block in the section", async ({ page }) => {
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
			// collapsed is the default, so flip each block to expanded first so the
			// 收闔 action has an observable effect.
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
			// collapseSectionBlocks -> renderAll re-renders from ui.collapsed.blocks,
			// so each block carries the same collapsed cues as a manual toggle.
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
	// The newly seeded block renders as the open block (renderAll {openBlockId}),
	// so its post-seed collapse state is not a stable "default". Drive the toggle
	// to a known state instead: collapse, then expand, so block.view's setOpen
	// (block-view.js:106-118) writes ui.collapsed.blocks[id]=false + changed()
	// -> localStorage (section-renderer.js:165-169). After reload, the restored
	// collapsed-default would close it again unless the persisted expanded state wins.

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
		// Expanded was persisted via block-view onToggle (section-renderer.js:165-169)
		// -> save -> localStorage. If it hadn't, reload would restore the collapsed
		// default (isCollapsed ?? true, section-renderer.js:162).
		await expect(afterToggle).toHaveAttribute("aria-expanded", "true");
		await expect(
			page.locator("#sections [data-block] [data-block-collapsible]").first(),
		).toBeVisible();
	});
});
