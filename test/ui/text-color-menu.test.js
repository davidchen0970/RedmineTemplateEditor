import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";

test("text color menu: right-click on a selection wraps it in %{color:...}", async () => {
	const { w } = makeDom('<textarea id="ta"></textarea>');
	const { setupTextColorContextMenu } = await import("../../src/ui/formatting/text-color-menu.js");

	setupTextColorContextMenu();

	const ta = w.document.getElementById("ta");
	ta.value = "hello world";
	ta.setSelectionRange(0, 5); // select "hello"

	ta.dispatchEvent(new w.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));

	const red = w.document.querySelector('[data-color="red"]');
	assert.ok(red, "the red color button exists");
	red.click();

	assert.equal(ta.value, "%{color:red}hello% world", "the selected token is wrapped in a color span");
});

test("text color menu: a collapsed selection does not wrap text", async () => {
	const { w } = makeDom('<textarea id="ta"></textarea>');
	const { setupTextColorContextMenu } = await import("../../src/ui/formatting/text-color-menu.js");

	// Module already imported in this file; call again to bind listeners.
	setupTextColorContextMenu();

	const ta = w.document.getElementById("ta");
	ta.value = "hello world";
	ta.setSelectionRange(3, 3); // caret, no selection

	const before = ta.value;
	ta.dispatchEvent(new w.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
	assert.equal(ta.value, before, "no wrapping happens with an empty selection");
});
