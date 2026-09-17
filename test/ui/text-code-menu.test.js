import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";

test("text code menu: right-click on a selection wraps it in @code@ and clears it", async () => {
	const { w } = makeDom('<textarea id="ta"></textarea>');
	const { setupTextCodeContextMenu } = await import("../../src/ui/formatting/text-code-menu.js");
	const { setupTextColorContextMenu } = await import("../../src/ui/formatting/text-color-menu.js");

	// Load the color menu first so both share the #textColorMenu shell.
	setupTextColorContextMenu();
	setupTextCodeContextMenu();

	const ta = w.document.getElementById("ta");
	ta.value = "hello world";
	ta.setSelectionRange(0, 5); // select "hello"

	ta.dispatchEvent(new w.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 6, clientY: 6 }));
	const codeBtn = w.document.querySelector("[data-inline-code]");
	assert.ok(codeBtn, "the inline-code button exists");
	codeBtn.click();
	assert.equal(ta.value, "@hello@ world", "the selection is wrapped in code markers");

	// Select the whole @hello@ marker, then clear it.
	const atStart = ta.value.indexOf("@");
	ta.setSelectionRange(atStart, atStart + "@hello@".length);
	ta.dispatchEvent(new w.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
	const clearBtn = w.document.querySelector("[data-clear-inline-code]");
	assert.ok(clearBtn, "the clear-code button exists");
	clearBtn.click();
	assert.equal(ta.value, "hello world", "clearing code unwraps the markers");
});
