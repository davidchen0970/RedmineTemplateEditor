import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";

// The full PNG path needs canvas + Image + fonts that jsdom does not ship, so the
// unit test pins the contract that matters here: the helper is safe on an absent
// <svg> (it must resolve without touching document.fonts / canvas).
test("mermaid-export: exporting with no target resolves cleanly", async () => {
	const { w } = makeDom();
	const { exportMermaidPng } = await import("../../src/ui/output/mermaid-export.js");
	const result = await exportMermaidPng(null, "diagram.png");
	assert.equal(result, undefined);
});
