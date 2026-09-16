import { test } from "node:test";
import assert from "node:assert/strict";
import { replaceMermaidBlocks, SHORTCUTS } from "../../src/app/keyboard-shortcuts.js";

test("shortcut: catalog pairs every shortcut with a non-empty action", () => {
	assert.ok(Array.isArray(SHORTCUTS) && SHORTCUTS.length > 0);
	for (const shortcut of SHORTCUTS) {
		assert.ok(typeof shortcut.code === "string" && shortcut.code.length > 0);
		assert.ok(typeof shortcut.keys === "string" && shortcut.keys.length > 0);
		assert.ok(typeof shortcut.action === "string" && shortcut.action.length > 0);
	}
});

test("shortcut: catalog codes are unique", () => {
	const codes = SHORTCUTS.map((shortcut) => shortcut.code);
	assert.equal(new Set(codes).size, codes.length);
});

test("shortcut: leaves non-mermaid lines untouched", () => {
	const text = "# t\n## s\n- a\n";
	assert.equal(replaceMermaidBlocks(text, []), text);
});

test("shortcut: swaps a mermaid block for its png in order", () => {
	const text = [
		"h3. Flow",
		" {{mermaid",
		"---",
		"flowchart LR",
		"A-->B",
		"}}",
		"end.",
	].join("\n");
	const out = replaceMermaidBlocks(text, ["Screenshot_1.png"]);
	assert.deepEqual(out.split("\n"), ["h3. Flow", "!Screenshot_1.png!", "end."]);
});

test("shortcut: maps multiple mermaid blocks to names in order", () => {
	const text = [
		" {{mermaid",
		"---",
		"flowchart LR",
		"a",
		"}}",
		"text in between",
		" {{mermaid",
		"---",
		"flowchart LR",
		"b",
		"}}",
	].join("\n");
	const out = replaceMermaidBlocks(text, ["one.png", "two.png"]);
	assert.deepEqual(out.split("\n"), ["!one.png!", "text in between", "!two.png!"]);
});
