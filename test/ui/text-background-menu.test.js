import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";

test("text background menu: wraps the selection in a %{background:...} span", async () => {
	const { w } = makeDom('<textarea id="ta"></textarea>');
	const { setupTextBackgroundContextMenu } = await import("../../src/ui/formatting/text-background-menu.js");

	// The background menu shares the #textColorMenu shell; load the color menu so
	// the shared chrome exists inside the current DOM.
	const { setupTextColorContextMenu } = await import("../../src/ui/formatting/text-color-menu.js");
	setupTextColorContextMenu();
	setupTextBackgroundContextMenu();

	const ta = w.document.getElementById("ta");
	ta.value = "hello world";
	ta.setSelectionRange(0, 5);

	ta.dispatchEvent(new w.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
	const yellow = w.document.querySelector('[data-background-color="yellow"]');
	assert.ok(yellow);
	yellow.click();
	assert.equal(ta.value, "%{background:yellow}hello% world");
});
