import { test } from "node:test";
import assert from "node:assert/strict";
import { block, createSection, escapeHtml, makeState, toNonEmptyTrimmedLines } from "../src/core/state.js";

test("escapeHtml escapes &, <, >, and quotes", () => {
	assert.equal(escapeHtml("<a href=\"x&y\">"), "&lt;a href=&quot;x&amp;y&quot;&gt;");
});

test("toNonEmptyTrimmedLines drops blank/whitespace lines", () => {
	assert.deepEqual(toNonEmptyTrimmedLines("\n  a  \nb\n  \n"), ["a", "b"]);
});

test("block builds a single-content block", () => {
	const b = block("mermaid", "diag", "flowchart LR");
	assert.equal(b.type, "mermaid");
	assert.equal(b.title, "diag");
	assert.deepEqual(b.contents, ["flowchart LR"]);
});

test("makeState returns a state object with the preset sections", () => {
	const s = makeState();
	const shape = s.sections.map((section) => [section.title, section.enabled]);
	assert.deepEqual(shape, [
		["Block Diagram", false],
		["Schematic", false],
		["實作流程", false],
		["結果驗證", false],
		["參考資料", false],
	]);
});
