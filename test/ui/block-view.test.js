import { test } from "node:test";
import assert from "node:assert/strict";
import { titleDisabled, defaultTitle, label } from "../../src/ui/editor/block-view.js";

test("titleDisabled only locks the 純文字 (plainText) block type", () => {
	assert.equal(titleDisabled("plainText"), true);
});

test("titleDisabled is false for every titled block type", () => {
	for (const type of ["implementation", "text", "command", "diff", "log", "mermaid", "image", "collapse"]) {
		assert.equal(titleDisabled(type), false, type);
	}
});

test("titleDisabled guards unknown/empty type", () => {
	assert.equal(titleDisabled("anything"), false);
	assert.equal(titleDisabled(""), false);
	assert.equal(titleDisabled(undefined), false);
});

test("every BLOCK_TYPE has a stable user-facing label and default title", () => {
	assert.ok(typeof label("plainText") === "string" && label("plainText").length > 0);
	for (const t of ["implementation", "text", "plainText", "command", "diff", "log", "mermaid", "image", "collapse"]) {
		assert.ok(typeof label(t) === "string" && label(t).length > 0, `label(${t})`);
		assert.ok(typeof defaultTitle(t) === "string", `defaultTitle(${t})`);
	}
});
