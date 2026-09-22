import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";

// confirm-dialog keeps a module-level singleton <dialog>, so the whole file shares
// one DOM (a fresh makeDom per test would orphan the singleton).
test("confirm: runs the action on confirm and skips it on cancel", async () => {
	const { w } = makeDom();
	const { confirmDelete } = await import("../../src/ui/dialogs/confirm-dialog.js");

	let acted = 0;
	confirmDelete({ heading: "刪除", text: "確定？", onConfirm: () => { acted += 1; } });
	const box = w.document.querySelector("dialog");
	assert.ok(box.hasAttribute("open"));
	assert.equal(box.querySelector("[data-head]").textContent, "刪除");
	box.querySelector("[data-confirm]").click();
	assert.equal(acted, 1, "confirm runs the action");

	confirmDelete({ heading: "h", text: "t", onConfirm: () => { acted += 1; } });
	box.querySelector("[data-cancel]").click();
	assert.equal(acted, 1, "cancel does not run the action");

	confirmDelete({ heading: "h", text: "t", onConfirm: () => { acted += 1; } });
	box.dispatchEvent(new w.Event("click", { bubbles: true }));
	assert.equal(box.hasAttribute("open"), false, "backdrop closes the dialog");
	assert.equal(acted, 1, "backdrop does not run the action");
});

test("confirm: dialog buttons take their labels from the locale dict", async () => {
	const { confirmDelete } = await import("../../src/ui/dialogs/confirm-dialog.js");

	confirmDelete({ heading: "h", text: "t", onConfirm: () => {} });
	// The dialog is a module-level singleton; the first test's makeDom() already
	// installed `document` on the process globals)Skip-bot so query it here.
	const box = document.querySelector("dialog");
	// In jsdom the language falls back to en (Node navigator.language is en-US and
	// cannot be overridden), so the buttons read the en locale resources.
	assert.equal(box.querySelector("[data-confirm]").textContent, "Confirm");
	assert.equal(box.querySelector("[data-cancel]").textContent, "Cancel");
});
