import { test, expect } from "@playwright/test";

// The porting preset starts with 3 sections whose bodies are collapsed and whose
// "enabled" flag is false (makeState → presets.porting, model.js:93-97,
// createSection(..., false)). The generator only emits blocks/titles of
// section.enabled sections (generator.js:135), so any test that expects content
// inside #out enables its section via [data-se] first.
//
// Selectors used and where they come from (section-renderer.js):
//   [data-se]          line 139  checkbox that flips section.enabled
//   [data-title]       line 148  section title input; oninput -> renderOutput
//   [data-up]/[data-down] 122-123  move(sectionId, ±1)
//   [data-more-toggle] line 125  "其他 ▾" opens the section menu (main.js:66-78)
//   [data-more]        line 124  menu wrapper hosting the .more-items buttons
//   [data-add]         line 127  "新增區塊" (addBlock dialog)
//   [data-add-section] line 128
//   [data-duplicate]   line 129  duplicate(sectionId)
//   [data-order]       line 131  toggleOrder(sectionId)
//   [#sections .section] line 113
//   [#out]             index.html:139 (readonly textarea, only toHaveValue)

// Every [data-*] menu/open/up/down/order button is rendered TWICE per section
// (head actions + footer actions, both from actionsHtml), so every interaction
// needs .first(). [data-title] and [data-se] render exactly once each.

async function seedBlock(page, section, title = "seed-block") {
	await section.locator("[data-more-toggle]").first().click();
	await section.locator("[data-more]").first().locator("[data-add]").click();
	const dialog = page.locator("dialog#abDialog");
	await dialog.locator("#abTitle").fill(title);
	// The dialog defaults to an "implementation" block (add-block-dialog.js:189).
	// Only implementation blocks ALWAYS emit "<marker> <title>" (generator.js:198),
	// which is what the ordered/unordered (false/true) marker assertions rely on.
	await dialog.locator("#abMain textarea").fill("int x;");
	await dialog.locator("#abForm button[type=submit]").click();
	await expect(dialog).toBeHidden();
}

test("duplicate section button duplicates a section", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const sections = page.locator("#sections .section");
	const before = await sections.count();
	await test.step("open the other menu and duplicate", async () => {
		const section = sections.first();
		await section.locator("[data-more-toggle]").first().click();
		await section.locator("[data-more]").first().locator("[data-duplicate]").click();
	});
	await test.step("expect one more section", async () => {
		await expect(sections).toHaveCount(before + 1);
	});
});

test("move up/down button reorders sections", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const sections = page.locator("#sections .section");
	const titleOf = (nth) => sections.nth(nth).locator("[data-title]").first();
	// [data-title] lives in the (collapsed) section-body, but inputValue()/toHaveValue
	// never require visibility, so no need to expand the section here.
	const firstTitle = await titleOf(0).inputValue();
	const secondTitle = await titleOf(1).inputValue();
	await test.step("move the second section up", async () => {
		// [data-up] exists twice per section; .first() is the visible head action.
		await titleOf(1);
		await sections.nth(1).locator("[data-up]").first().click();
	});
	await test.step("the two sections swapped order", async () => {
		await expect(titleOf(0)).toHaveValue(secondTitle);
		await expect(titleOf(1)).toHaveValue(firstTitle);
	});
});

test("changing the section title button reflects into #out as h3.", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const section = page.locator("#sections .section").first();
	const ts = Date.now();
	await test.step("enable the section so the generator emits it", async () => {
		await section.locator("[data-se]").first().check();
	});
	await test.step("expand the section body so data-title is actionable", async () => {
		// After [data-se] re-renders, the section is re-collapsed (isCollapsed default
		// true, section-renderer.js:114); .collapsed (shell-layout.css:254) makes it
		// height:0/opacity:0. Un-collapse before overlapping calls fill().
		await section.locator(".section-title-btn").first().click();
	});
	await test.step("type a fresh title", async () => {
		await section.locator("[data-title]").first().fill(`e2e-title-${ts}`);
	});
	await test.step("#out contains the new h3 heading", async () => {
		// generator addH3 emits "h3. {title}" (generator.js:36-38) only once the
		// section is enabled. #out is readonly, so assert via RegExp, never a predicate.
		await expect(page.locator("#out")).toHaveValue(new RegExp(`h3\\.\\s*e2e-title-${ts}`));
	});
});

test("ordered/unordered item button toggle switches #/* markers in #out", async ({ page }) => {
	await test.step("open the editor", () => page.goto("/"));
	const section = page.locator("#sections .section").first();
	const ts = Date.now();
	const title = `seed-order-${ts}`;
	await test.step("enable the section", async () => {
		await section.locator("[data-se]").first().check();
	});
	await test.step("seed an implementation block (marker is always emitted)", async () => {
		await seedBlock(page, section, title);
	});
	await test.step("ordered marker # is present", async () => {
		// Default section.unordered is not true => ordered => blockMarker is "*" if
		// unordered else "#" (generator.js:158-161); implementation pushes "<marker> title".
		await expect(page.locator("#out")).toHaveValue(new RegExp(`# ${title}`));
	});
	await test.step("toggle to unordered", async () => {
		await section.locator("[data-more-toggle]").first().click();
		await section.locator("[data-more]").first().locator("[data-order]").click();
	});
	await test.step("marker flipped to *", async () => {
		await expect(page.locator("#out")).toHaveValue(new RegExp(`\\* ${title}`));
	});
});
