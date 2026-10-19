import { test, expect } from "@playwright/test";

// Diff-type additions through the add-block dialog, grounded in add-block-dialog.js.
// The porting preset ships sections with zero blocks, opened collapsed. These tests
// focus on the diff type's "upload file <-> paste content" mutual exclusion and its
// staging leftovers, so they deliberately pick assertions the generic diff test in
// blocks.spec.js does not make (that one proves 2-file preview + uncheck -> add one).
//
// Selectors and the behaviours they pin down (add-block-dialog.js):
//   [data-ab="diffFile"]  line 32  diff main field, type=file accept .diff/.patch/.txt.
//        onchange (line 127) splits the patch (splitPatch, import-actions.js) into
//        pendingDiffFiles, each { name, folder, content, selected:true }, and makes
//        the "content" paste field disabled (renderDiffPreview, line 149).
//   [data-ab="content"]   line 33  the diff paste textarea. Disabled exactly while
//        selectedType === "diff" && pendingDiffFiles.length > 0 (line 149), i.e. only
//        while a patch file is staged — the upload-vs-paste exclusion under test.
//   #abDiffPreview .note  lines 150-176  one row per staged file; visible only when a
//        diff file is staged (line 150); empty/hidden otherwise (lines 151-152).
//   #abTypes [data-ab-type]  renderTypeCards line 192-200: clicking a card clears
//        pendingDiffFiles whenever the new type is not diff (line 196), so switching
//        away from diff rebuilds #abMain without the file input and leaves the text
//        type's own content field enabled.
//   data-btype            block-view.js:96  rendered <select> holding block.type.
//   buildDiffUnits        add-block-dialog.js:370  uploaded files become one impl block
//        each with title == item.name (line 372); a pure paste has no staged file, so
//        onsubmit falls through to buildBlock -> block("diff", title, content) (line 217).

// Sections render the more menu twice (head + footer actions), so [data-add] needs
// .first() (see the selector notes header in blocks-add.spec.js); the dialog body
// renders only once, so #abTypes/#abMain inside it need no .first().
async function openAddDialog(page, section) {
	await section.locator("[data-more-toggle]").first().click();
	await section.locator("[data-more]").first().locator("[data-add]").first().click();
	return page.locator("dialog#abDialog");
}

// A multi-file patch: splitPatch (import-actions.js:18) -> name "eth.c"/"tun.c". Each
// file becomes its own preview row and, once staged, its own block titled by the file.
const PATCH = [
	"diff --git a/net/eth.c b/net/eth.c",
	"@@ -0,0 +1,2 @@",
	"+int eth;",
	"diff --git a/net/tun.c b/net/tun.c",
	"@@ -0,0 +1,2 @@",
	"+int tun;",
].join("\n");

test("after uploading a diff file the paste textarea is disabled and the patch previews", async ({ page }) => {
	await test.step("open the editor and the add-block dialog", async () => {
		await page.goto("/");
		const dialog = await openAddDialog(page, page.locator("#sections .section").first());
		await dialog.locator("#abTypes [data-ab-type='diff']").click();
	});
	await test.step("upload a patch and expect the paste field to become disabled", async () => {
		const dialog = page.locator("dialog#abDialog");
		// With no file yet the empty diff paste textarea is enabled (line 149 false).
		await expect(dialog.locator('[data-ab="content"]')).toBeEnabled();
		await dialog.locator('[data-ab="diffFile"]').setInputFiles({
			name: "net.patch",
			mimeType: "text/plain",
			buffer: Buffer.from(PATCH),
		});
		// Uploading and pasting are mutually exclusive: once any file is staged,
		// the content field is disabled so no typed text gets silently discarded.
		await expect(dialog.locator('[data-ab="content"]')).toBeDisabled();
	});
	await test.step("expect both files previewed", async () => {
		// #abDiffPreview is shown (line 150) with one .note per staged file.
		const rows = page.locator("#abDiffPreview .note");
		await expect(rows).toHaveCount(2);
		await expect(rows.nth(0)).toContainText("eth.c");
		await expect(rows.nth(1)).toContainText("tun.c");
	});
});

test("submitting with a staged file adds only the selected blocks, not any pasted text", async ({ page }) => {
	await test.step("open the editor and the add-block dialog", async () => {
		await page.goto("/");
		const dialog = await openAddDialog(page, page.locator("#sections .section").first());
		await dialog.locator("#abTypes [data-ab-type='diff']").click();
	});
	const blocks = page.locator("#sections [data-block]");
	await test.step("upload a 2-file patch and confirm the paste field rejects text", async () => {
		const dialog = page.locator("dialog#abDialog");
		await dialog.locator('[data-ab="diffFile"]').setInputFiles({
			name: "net.patch",
			mimeType: "text/plain",
			buffer: Buffer.from(PATCH),
		});
		// The disabled paste field never holds content: read "empty" to prove the
		// exclusion left nothing staged that could leak into the added block. A real
		// user cannot type here, so "ignore the paste" is structural, not accidental.
		await expect(dialog.locator('[data-ab="content"]')).toBeDisabled();
		await expect(dialog.locator('[data-ab="content"]')).toHaveValue("");
	});
	await test.step("uncheck the second file and add only the first", async () => {
		const dialog = page.locator("dialog#abDialog");
		await page.locator("#abDiffPreview .note").nth(1).locator("input").uncheck();
		const before = await blocks.count();
		await dialog.locator("#abForm button[type=submit]").click();
		await expect(dialog).toBeHidden();
		// Only the still-checked file is spliced in (chosen = selected items, line 289).
		await expect(blocks).toHaveCount(before + 1);
	});
	await test.step("the added block carries the checked file's name", async () => {
		await expect.poll(async () => {
			const titles = await page.locator("#sections [data-block] [data-btitle]").evaluateAll((els) =>
				els.map((el) => el.value)
			);
			return titles.filter((value) => value === "eth.c").length;
		}).toBe(1);
	});
});

test("switching away from diff clears the staged preview and re-enables the content field", async ({ page }) => {
	await test.step("open the editor and the add-block dialog, then stage a diff file", async () => {
		await page.goto("/");
		const dialog = await openAddDialog(page, page.locator("#sections .section").first());
		await dialog.locator("#abTypes [data-ab-type='diff']").click();
		await dialog.locator('[data-ab="diffFile"]').setInputFiles({
			name: "net.patch",
			mimeType: "text/plain",
			buffer: Buffer.from(PATCH),
		});
		await expect(page.locator("#abDiffPreview .note")).toHaveCount(2);
	});
	await test.step("switch to the text type and expect the diff leftovers to clear", async () => {
		const dialog = page.locator("dialog#abDialog");
		// Clicking a non-diff card drops pendingDiffFiles (renderTypeCards, line 196)
		// before renderFields runs, so #abMain is rebuilt for text (only a content
		// textarea) and renderDiffPreview(139) now hides/empties #abDiffPreview (151).
		await dialog.locator("#abTypes [data-ab-type='text']").click();
		// The preview container stays in the dialog but is hidden and emptied.
		await expect(page.locator("#abDiffPreview")).toBeHidden();
		await expect(page.locator("#abDiffPreview")).toBeEmpty();
		// The text type's own content textarea is enabled again — nothing is staged to
		// keep the diff paste field's disabled state around.
		await expect(dialog.locator('[data-ab="content"]')).toBeEnabled();
	});
	await test.step("returning to diff also starts clean: no leftover preview", async () => {
		const dialog = page.locator("dialog#abDialog");
		await dialog.locator("#abTypes [data-ab-type='diff']").click();
		// pendingDiffFiles stayed cleared while away, so re-entering diff shows no
		// stale preview and its paste field is usable again (line 149 false).
		await expect(page.locator("#abDiffPreview .note")).toHaveCount(0);
		await expect(dialog.locator('[data-ab="content"]')).toBeEnabled();
		await dialog.locator("#abCancel").click();
		await expect(dialog).toBeHidden();
	});
});

test("pasting diff text with no file creates a diff block", async ({ page }) => {
	await test.step("open the editor and the add-block dialog", async () => {
		await page.goto("/");
		const dialog = await openAddDialog(page, page.locator("#sections .section").first());
		await dialog.locator("#abTypes [data-ab-type='diff']").click();
	});
	const blocks = page.locator("#sections [data-block]");
	await test.step("paste diff text (no file staged) and submit", async () => {
		const dialog = page.locator("dialog#abDialog");
		// Without a staged file the paste field is enabled, so a pure-paste diff block
		// is legitimate: this is the flip side of the upload-vs-paste exclusion.
		await expect(dialog.locator('[data-ab="content"]')).toBeEnabled();
		await dialog.locator('[data-ab="content"]').fill("@@ -0,0 +1,2 @@\n+int pasted;");
		const before = await blocks.count();
		await dialog.locator("#abForm button[type=submit]").click();
		await expect(dialog).toBeHidden();
		// No file is staged, so onsubmit bypasses the diff-unit loop (line 290) and goes
		// to buildBlock (add-block-dialog.js:308), producing exactly one block.
		await expect(blocks).toHaveCount(before + 1);
	});
	await test.step("the new block is a diff-typed block", async () => {
		// block("diff", title, content) -> btype select value "diff" (block-view.js:96).
		await expect(blocks.first().locator("[data-btype]")).toHaveValue("diff");
	});
});
