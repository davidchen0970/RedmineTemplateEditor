// Settings dialog behavior against a jsdom DOM.
//
// settings-dialog.js keeps a module-level `dialog` singleton, so all the
// assertions run in one test against the single dialog the first setup builds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";

test("settings: builds rows, opens from #settingsOpen, closes on backdrop", async () => {
	const { w, counts } = makeDom(`
		<button id="langToggle" type="button"></button>
		<button id="themeToggle" type="button"></button>
		<button id="shortcutHelp" type="button"></button>
		<button id="settingsOpen" type="button">設定</button>
	`);
	const { setupSettingsDialog } = await import("../../src/ui/dialogs/settings-dialog.js");

	const dialog = setupSettingsDialog();

	// 1. Dialog is appended with the shared chrome + one row per control.
	assert.ok(w.document.body.contains(dialog));
	assert.ok(dialog.classList.contains("settings-dialog"));
	assert.equal(dialog.querySelectorAll(".settings-row").length, 3);
	assert.ok(dialog.querySelector('[data-settings-key="settings.lang"]'));
	assert.ok(dialog.querySelector('[data-settings-key="settings.theme"]'));
	assert.ok(dialog.querySelector('[data-settings-key="settings.shortcuts"]'));

	// 2. Clicking #settingsOpen shows the dialog.
	w.document.querySelector("#settingsOpen").dispatchEvent(new w.Event("click", { bubbles: true }));
	assert.equal(counts.showed, 1);
	assert.equal(dialog.getAttribute("open"), "");

	// 3. Clicking the dialog's own background closes it (backdrop click).
	dialog.dispatchEvent(new w.Event("click", { bubbles: true }));
	assert.equal(counts.closed, 1);

	// 4. i18n:change re-labels the heading.
	const head = dialog.querySelector(".dialog-head");
	head.textContent = "dirty";
	w.document.dispatchEvent(new w.CustomEvent("i18n:change"));
	assert.ok(head.textContent.length > 0 && head.textContent !== "dirty");
});
