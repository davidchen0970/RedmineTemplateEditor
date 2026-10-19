// Add-block dialog behavior against a jsdom DOM.
//
// Covers the recent add-block regressions, driven through the created dialog's
// public `add()` entry point:
//   1. a successful submit forces the hosting section open
//      (ui.collapsed.sections[sectionId] = false) via expandSection, observed
//      through the renderAll spy + shared state.
//   2. re-clicking the SAME type card keeps the typed title; only switching to a
//      DIFFERENT type resets it to that type's default.
//   3. every `add()` resets selectedType back to "implementation" (no stale type).
//   4. diff type: staging an uploaded file disables the pasted-content textarea;
//      switching away from diff clears the staged preview and re-enables it.
//   5. the submitted level is clamped to getMaxBlockLevel at the insertion point
//      (first block max 1, a level-1 first block makes the second max 2).
//   6. in the implementation extra group (#abExtra) the showWorkPath checkbox is the
//      FIRST field, is a field-checkbox (inline layout), and defaults to checked.
//
// The real browser-ism path (scrollIntoView, markEntering) degrades gracefully in
// jsdom: blockCard() finds no `.block[data-block=<id>]` node, so both are
// safe no-ops.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";
import { defaultTitle } from "../../src/ui/editor/block-view.js";

makeDom(); // globals must exist before the source module import runs.

const { createAddBlockDialog } = await import("../../src/ui/dialogs/add-block-dialog.js");

// createAddBlockDialog appends its <dialog> to `document`; give every test its
// own document so no closure's event handlers leak into the next test.
beforeEach(() => {
	makeDom();
});

// Shared fixture: a one-section app state plus the wiring createAddBlockDialog
// needs. `seen` records every renderAll() argument; `calls.changed` counts
// changed() invocations; the pseudo-"section cards" reveal/markEntering look for
// are deliberately absent so those lookups short-circuit safely.
function makeDialog(calls = { changed: 0 }, seen = []) {
	const state = {
		sections: [{ id: "s1", title: "實作", enabled: true, blocks: [] }],
		ui: { collapsed: { sections: {}, blocks: {} } },
	};
	const api = createAddBlockDialog({
		findSection: (id) => state.sections.find((s) => s.id === id),
		changed: () => { calls.changed += 1; },
		renderAll: (opt) => seen.push(opt),
		getState: () => state,
	});
	return { state, calls, seen, api };
}

function dialogEl() {
	return document.getElementById("abDialog");
}

function activeType(dialog) {
	const card = dialog.querySelector("#abTypes .card.active");
	return card ? card.dataset.abType : null;
}

function clickType(dialog, type) {
	dialog.querySelector(`#abTypes [data-ab-type="${type}"]`).click();
}

function submit(dialog) {
	dialog.querySelector("#abForm").dispatchEvent(
		new window.Event("submit", { bubbles: true, cancelable: true }),
	);
}

test("successful submit expands the hosting section and renders with the block id", () => {
	const { state, seen, calls, api } = makeDialog();
	api.add("s1");
	const dialog = dialogEl();
	dialog.querySelector("#abTitle").value = "我的程式";
	submit(dialog);

	assert.equal(state.sections[0].blocks.length, 1);
	const block = state.sections[0].blocks[0];
	assert.equal(block.title, "我的程式");
	// expandSection(sectionId) forces the section open.
	assert.equal(state.ui.collapsed.sections["s1"], false);
	// changed() fired and renderAll received the freshly inserted block's id.
	assert.equal(calls.changed, 1);
	assert.deepEqual(seen, [{ openBlockId: block.id }]);
	assert.equal(block.type, "implementation");
	assert.equal(block.level, 1);
});

test("same-type card re-click keeps the typed title; switching type resets it", () => {
	const { api } = makeDialog();
	api.add("s1");
	const dialog = dialogEl();
	const title = dialog.querySelector("#abTitle");
	title.value = "keep me";
	clickType(dialog, "implementation"); // same type: typeChanged === false
	assert.equal(title.value, "keep me");

	clickType(dialog, "text"); // different type: title becomes that type's default
	assert.equal(title.value, defaultTitle("text"));
});

test("add() always resets to implementation even after picking another type", () => {
	const { api } = makeDialog();
	api.add("s1");
	let dialog = dialogEl();
	assert.equal(activeType(dialog), "implementation");
	assert.equal(dialog.querySelector("#abTitle").value, defaultTitle("implementation"));

	clickType(dialog, "text");
	assert.equal(activeType(dialogEl()), "text");

	// Re-opens are via add(), which must reset the persisted selectedType.
	api.add("s1");
	dialog = dialogEl();
	assert.equal(activeType(dialog), "implementation");
	assert.equal(dialog.querySelector("#abTitle").value, defaultTitle("implementation"));
});

test("diff: uploaded diff disables the pasted-content field; leaving diff clears it", () => {
	const { api } = makeDialog();
	api.add("s1");
	const dialog = dialogEl();
	clickType(dialog, "diff");

	const fileInput = dialog.querySelector('[data-ab="diffFile"]');
	const content = dialog.querySelector('[data-ab="content"]');
	assert.equal(content.disabled, false);

	// Stage a "file": the onchange handler reads fileInput.files[0] through a
	// FileReader whose readAsText resolves synchronously.
	Object.defineProperty(fileInput, "files", { configurable: true, value: [{}] });
	globalThis.FileReader = class {
		constructor() { this.onload = null; }
		readAsText() {
			this.result = "diff --git a/src/a.c b/src/a.c\n@@ -1 +1 @@\n+p";
			if (this.onload) this.onload();
		}
	};
	fileInput.onchange();
	assert.equal(content.disabled, true);
	const preview = dialog.querySelector("#abDiffPreview");
	assert.equal(preview.hidden, false);
	assert.equal(preview.children.length, 1);

	// Leave the diff type: staged files are dropped, the disable is lifted, and the
	// preview is emptied rather than left lingering.
	clickType(dialog, "text");
	assert.equal(dialog.querySelector('[data-ab="content"]').disabled, false);
	assert.equal(preview.hidden, true);
	assert.equal(preview.children.length, 0);
});

test("submitted level is clamped to getMaxBlockLevel at the insertion point", () => {
	const { state, api } = makeDialog();
	// First block in an empty section sits at index 0 -> max level 1.
	api.add("s1");
	let dialog = dialogEl();
	dialog.querySelector("#abLevel").value = 99;
	submit(dialog);
	assert.equal(state.sections[0].blocks[0].level, 1);

	// Second block lands after a level-1 block -> max level 2.
	api.add("s1");
	dialog = dialogEl();
	dialog.querySelector("#abLevel").value = 99;
	submit(dialog);
	assert.equal(state.sections[0].blocks[1].level, 2);
});

test("implementation extras: showWorkPath checkbox is first, inline, and default-checked", () => {
	const { api } = makeDialog();
	api.add("s1");
	const dialog = dialogEl();
	const extra = dialog.querySelector("#abExtra");

	// The work-path group fields render in IMPL_EXTRAS order: showWorkPath must be the
	// first field so its toggle sits above the editable work-path inputs.
	const first = extra.children[0];
	assert.equal(first.querySelector("[data-ab='showWorkPath']") !== null, true);
	assert.equal(first.classList.contains("field-checkbox"), true);
	assert.equal(first.querySelector("[data-ab='showWorkPath']").type, "checkbox");
	assert.equal(first.querySelector("[data-ab='showWorkPath']").checked, true);

	// showWorkPath precedes the workPathTitle input in the same group.
	const showPathIdx = Array.from(extra.children).findIndex(
		(el) => el.querySelector("[data-ab='showWorkPath']"),
	);
	const workPathTitleIdx = Array.from(extra.children).findIndex(
		(el) => el.querySelector("[data-ab='workPathTitle']"),
	);
	assert.ok(showPathIdx >= 0 && showPathIdx < workPathTitleIdx);
});
