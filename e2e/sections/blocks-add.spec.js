import { test, expect } from "@playwright/test";

// Flows around the add-block dialog ("新增區塊"), grounded in add-block-dialog.js and
// section-renderer.js. The porting preset ships three sections whose bodies start
// collapsed (section-renderer.js:115 isCollapsed default true -> bodyClass
// ".collapsed" at line 118, made height:0/opacity:0 by shell-layout.css:254) and
// zero blocks per section.
//
// Selectors used and where they come from:
//   section [data-more-toggle] line 126  "其他 ▾", rendered TWICE per section
//        (head actions + footer actions, both from actionsHtml at line 121), so always
//        use .first().
//   section [data-more]        line 125  menu wrapper, also repeated -> .first().
//   section [data-more] [data-add] line 128  "新增區塊", repeated -> .first().
//   dialog#abDialog            add-block-dialog.js:237  the modal; only one instance,
//        so the type cards #abTypes and fields inside it need no .first().
//   #abTitle                  add-block-dialog.js:245  title input.
//   #abMain textarea           add-block-dialog.js:116  main-field textarea.
//   #abForm button[type=submit]  add-block-dialog.js:256  "add".
//   section .section-body      section-renderer.js:148  holds data-blocks; class
//        "collapsed" when the section is closed.
//   section .section-title-btn section-renderer.js:141  aria-expanded = String(!collapsed).

async function openAddDialog(page, section) {
	await section.locator("[data-more-toggle]").first().click();
	await section.locator("[data-more]").first().locator("[data-add]").click();
	return page.locator("dialog#abDialog");
}

test("submitting the dialog auto-expands the hosting section so the new block shows", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const section = page.locator("#sections .section").first();

	await test.step("the porting section starts collapsed", async () => {
		// No ui.collapsed.sections entry exists yet, so isCollapsed falls back to
		// default true (section-renderer.js:115) -> body carries .collapsed and the
		// title toggle reports aria-expanded="false".
		await expect(section.locator(".section-body")).toHaveClass(/collapsed/);
		await expect(section.locator(".section-title-btn")).toHaveAttribute("aria-expanded", "false");
	});

	await test.step("add a block through the dialog", async () => {
		const dialog = await openAddDialog(page, section);
		await dialog.locator("#abTitle").fill("expand-me");
		await dialog.locator("#abMain textarea").fill("int x;");
		await dialog.locator("#abForm button[type=submit]").click();
		await expect(dialog).toBeHidden();
	});

	await test.step("add() expanded the section body and revealed the new block", async () => {
		// The fix: onsubmit calls expandSection(section.id) (add-block-dialog.js:314)
		// which sets ui.collapsed.sections[id]=false (lines 222-226) BEFORE renderAll,
		// so the re-render drops .collapsed and the block is actionable/visible.
		await expect(section.locator(".section-body")).not.toHaveClass(/collapsed/);
		await expect(section.locator(".section-title-btn")).toHaveAttribute("aria-expanded", "true");
		// .collapsed forced height:0/opacity:0; only an expanded body shows its block.
		await expect(section.locator(".section-body [data-block]").first()).toBeVisible();
	});
});
