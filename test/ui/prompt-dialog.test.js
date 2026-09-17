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
	box.querySelector("[data-confirm]").click();
	assert.deepEqual(confirmed, ["重命名"]);

	// Open again; cancel keeps onConfirm untouched.
	openPrompt({ heading: "h", label: "l", value: "v", onConfirm: (value) => confirmed.push(value) });
	box.querySelector("[data-cancel]").click();
	assert.deepEqual(confirmed, ["重命名"], "cancel does not run onConfirm");
});
