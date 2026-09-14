import { test } from "node:test";
import assert from "node:assert/strict";
import { textile } from "../src/textile/generator.js";
import {
	createImplementationBlock,
	createSection,
	makeState,
} from "../src/core/state.js";

function stateWithMermaid() {
	const s = makeState();
	s.title = "樣本";
	s.sections = [createSection("圖表", true, [makeBlock("mermaid", "diag", "flowchart LR\nA-->B")])];
	return s;
}

function makeBlock(type, title, content = "") {
	const presets = { block: null };
	return { id: "x", type, title, contents: content ? [content] : [""], level: 1 };
}

function stateWithImplementation() {
	const s = makeState();
	s.title = "impl";
	s.sections = [
		createSection("實作", true, [
			createImplementationBlock("api.c", "(docker)$ pwd", "c", "int x;"),
		]),
	];
	return s;
}

test("textile starts with the doc title (h2)", () => {
	const s = stateWithMermaid();
	const out = textile(s);
	assert.match(out, /^h2\. 樣本/);
});

test("textile emits the enabled section title (h3)", () => {
	const out = textile(stateWithMermaid());
	assert.match(out, /h3\. 圖表/);
});

test("textile emits a mermaid fence", () => {
	const out = textile(stateWithMermaid());
	assert.match(out, /{{mermaid/);
	assert.match(out, /flowchart LR/);
	assert.match(out, /\}\}/);
});

test("disabled sections are skipped", () => {
	const s = stateWithMermaid();
	s.sections = [createSection("隱藏", false)];
	const out = textile(s);
	assert.doesNotMatch(out, /h3\. 隱藏/);
});

test("textile renders a PASS status with a literal PASS span", () => {
	const s = makeState();
	s.status = "PASS";
	assert.match(textile(s), /%\{color:green\}PASS%/);
});

test("textile renders a WIP status with a literal WIP span", () => {
	const s = makeState();
	s.status = "WIP";
	assert.match(textile(s), /%\{color:orange\}WIP%/);
});

test("textile emits an implementation block with title, work path and per-content lang", () => {
	const out = textile(stateWithImplementation());
	assert.match(out, /# api\.c/);
	assert.match(out, /<pre><code class="c">/);
	assert.match(out, /int x;/);
	assert.match(out, /work path/);
});

test("textile keeps the relatedRef line", () => {
	const s = makeState();
	s.relatedRef = "見 #123";
	assert.match(textile(s), /見 #123/);
});
