// Shortcut help dialog: opens from #shortcutHelp, renders one row per shortcut
// in the active language, and closes on a backdrop click.
//
// shortcut-help-dialog.js holds a module-level `dialog` singleton, so the render
// and backdrop assertions share one DOM / one open cycle.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";

test("shortcut: opening from #shortcutHelp paints a row per shortcut and closes on backdrop", async () => {
	const { w, counts } = makeDom('<button id="shortcutHelp" type="button">快捷鍵</button>');
	const { SHORTCUTS } = await import("../../src/app/keyboard-shortcuts.js");
	const { setupShortcutHelp } = await import("../../src/ui/dialogs/shortcut-help-dialog.js");

	setupShortcutHelp();
	w.document.getElementById("shortcutHelp").click();

	// 1. The dialog appears with one localized row per registered shortcut.
	const dialog = w.document.getElementById("shortcutDialog");
	assert.ok(dialog, "dialog is created");
	assert.equal(dialog.querySelectorAll(".shortcut-row").length, SHORTCUTS.length);
	assert.ok(dialog.querySelector(".dialog-head").textContent.length > 0);
	for (const row of dialog.querySelectorAll(".shortcut-row")) {
		assert.ok(row.querySelector(".shortcut-action").textContent.length > 0);
	}

	// 2. A click on the dialog's own background closes it (backdrop click).
	dialog.dispatchEvent(new w.Event("click", { bubbles: true }));
	assert.equal(counts.closed, 1);
});
