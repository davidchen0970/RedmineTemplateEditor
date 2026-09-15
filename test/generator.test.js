import { test } from "node:test";
import assert from "node:assert/strict";
import { textile } from "../src/textile/generator.js";
import {
	createSection,
	makeState,
} from "../src/core/state.js";
import { makeBlock, stateWithEnvironment, stateWithImplementation, stateWithMermaid } from "./_fixtures.js";

test("environment emits only enabled and filled items", () => {
	const out = textile(stateWithEnvironment());
	assert.match(out, /\* System Model: DVT2/);
	assert.doesNotMatch(out, /BIOS: /);
	assert.doesNotMatch(out, /OS \/ Kernel/);
});

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

test("textile embeds the classic frontmatter at the head of a mermaid frame", () => {
	const out = textile(stateWithMermaid());
	assert.match(out, /{{mermaid\n---\nconfig:\n  layout: dagre\n  look: classic\n  theme: default\n---\nflowchart LR/);
});

test("textile prepends classic to a mermaid-language code frame", () => {
	const block = { type: "implementation", title: "diag", contents: [{ content: "flowchart TD\nA --> B", lang: "mermaid" }], showWorkPath: false };
	const s = makeState();
	s.sections = [createSection("概念", true, [block])];
	const out = textile(s);
	assert.match(out, /<code class="mermaid">\n---\nconfig:\n  layout: dagre\n  look: classic\n  theme: default\n---\nflowchart TD/);
	// 其它 lang 的 code frame 不得被塞入 classic
	const shellBlock = { type: "implementation", title: "cmd", contents: [{ content: "echo hi", lang: "shell" }], showWorkPath: false };
	const s2 = makeState();
	s2.sections = [createSection("實例", true, [shellBlock])];
	assert.doesNotMatch(textile(s2), /classic/);
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
