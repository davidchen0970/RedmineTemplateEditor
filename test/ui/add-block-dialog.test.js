// Add-block dialog behavior against a jsdom DOM.
//
// Covers the recent add-block regressions, driven through the created dialog's
// public `add()` entry point:
//   1. a successful submit forces the hosting section open
//      (ui.collapsed.sections[sectionId] = false) via expandSection, observed
//      through the renderAll spy + shared state.
//   2. re-clicking the SAME type card keeps the typed title; only switching to a
//      DIFFERENT type resets it to that type's default.
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
