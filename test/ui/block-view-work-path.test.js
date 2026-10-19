import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";
import { setLocale } from "../../src/i18n.js";

makeDom(); // globals must exist before the source module import runs.

const { createBlockElement } = await import("../../src/ui/editor/block-view.js");

// createBlockElement renders declaratively; give each case its own document so no
// element identity leaks across tests.
beforeEach(() => {
	makeDom();
	setLocale("zh");
});

function render(block) {
	const el = createBlockElement(block, 1);
	document.body.appendChild(el);
	return el;
}

test("implementation block: work-path toggle uses a class, not the duplicated #workPath id", () => {
	const el = render({ type: "implementation", title: "a.c", showWorkPath: true });

	const toggle = el.querySelector("[data-show-work]");
	assert.ok(toggle, "data-show-work checkbox exists");
	assert.equal(toggle.getAttribute("class"), "work-path-toggle");
	// The regression this guards: the checkbox previously carried id="workPath",
	// duplicating the add-block dialog's field id within the same document. It must be
	// a class-only selector now.
	assert.equal(el.querySelector("#workPath"), null);
	assert.equal(toggle.checked, true);
	// showWorkPath true -> the work-path fields stay visible.
	assert.equal(el.querySelector("[data-work-fields]").hidden, false);
});

test("implementation block hides the work-path fields when showWorkPath is false", () => {
	const el = render({ type: "implementation", title: "a.c", showWorkPath: false });

	const toggle = el.querySelector("[data-show-work]");
	assert.equal(toggle.checked, false);
	assert.equal(el.querySelector("[data-work-fields]").hidden, true);
});

test("non-implementation blocks render no work-path group at all", () => {
	const el = render({ type: "text", title: "說明", contents: [""] });
	assert.equal(el.querySelector("[data-show-work]"), null);
	assert.equal(el.querySelector("[data-work-fields]"), null);
});

test("work-path fields mirror the block's title, path and localized label", () => {
	const el = render({ type: "implementation", title: "api.c", workPath: "$ pwd", workPathTitle: "源碼", showWorkPath: true });

	assert.equal(el.querySelector("[data-work-title]").value, "源碼");
	assert.equal(el.querySelector("[data-work]").value, "$ pwd");
	assert.equal(el.querySelector("[data-work-label]").textContent, "源碼");
});

test("work-path label falls back to the localized default when no title is set", () => {
	const el = render({ type: "implementation", title: "api.c", workPath: "$ pwd", showWorkPath: true });

	// workPathTitle is empty -> label falls back to t("block.workPath") = 工作路徑 in zh.
	assert.equal(el.querySelector("[data-work-label]").textContent, "工作路徑");
});
