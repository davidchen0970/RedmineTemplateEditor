import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";

// prompt-dialog keeps a module-level singleton <dialog>, so the whole file shares
// one DOM (a fresh makeDom per test would orphan the singleton).
test("prompt: confirm resolves the typed value and cancel settles with none", async () => {
	const { w } = makeDom();
	const { openPrompt } = await import("../../src/ui/dialogs/prompt-dialog.js");

	const confirmed = [];
	openPrompt({ heading: "改名", label: "新名稱", value: "doc", onConfirm: (value) => confirmed.push(value) });
	const box = w.document.querySelector("dialog");
	assert.ok(box.hasAttribute("open"));
	assert.equal(box.querySelector("[data-value]").value, "doc");

	box.querySelector("[data-value]").value = "重命名";
	const form = box.querySelector("form");
	const submit = new w.Event("submit", { bubbles: true, cancelable: true });
	form.dispatchEvent(submit);
	assert.equal(submit.defaultPrevented, true, "onsubmit guards against implicit dialog close");
	assert.equal(box.hasAttribute("open"), false, "confirm closes the dialog");
	assert.deepEqual(confirmed, ["重命名"]);

	// Open again; cancel keeps onConfirm untouched.
	openPrompt({ heading: "h", label: "l", value: "v", onConfirm: (value) => confirmed.push(value) });
	box.querySelector("[data-cancel]").click();
	assert.deepEqual(confirmed, ["重命名"], "cancel does not run onConfirm");

	// A backdrop click (a click on the dialog's own background) dismisses too.
	openPrompt({ heading: "h", label: "l", value: "v", onConfirm: (value) => confirmed.push(value) });
	box.dispatchEvent(new w.Event("click", { bubbles: true }));
	assert.equal(box.hasAttribute("open"), false, "backdrop closes the dialog");
	assert.deepEqual(confirmed, ["重命名"], "backdrop does not run onConfirm");
});
