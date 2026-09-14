import { test } from "node:test";
import assert from "node:assert/strict";
import { textileToPreviewHtml } from "../src/textile/preview.js";

test("h2 heading renders an <h2>", () => {
	const html = textileToPreviewHtml("h2. 標題\n\n內文\n");
	assert.match(html, /<h2>/);
	assert.match(html, /標題/);
});

test("h3 heading renders an <h3>", () => {
	const html = textileToPreviewHtml("h3. 小節\n");
	assert.match(html, /<h3>/);
	assert.match(html, /小節/);
});

test("plain text becomes a <p>", () => {
	const html = textileToPreviewHtml("hello world\n");
	assert.match(html, /<p>/);
	assert.match(html, /hello world/);
});

test("mermaid fence content is collected into the host", () => {
	const html = textileToPreviewHtml("{{mermaid\nflowchart LR\nA-->B\n}}\n");
	assert.match(html, /class="mermaid"/);
	assert.match(html, /data-mermaid-source="flowchart LR/);
	assert.match(html, /A--&gt;B/);
	assert.doesNotMatch(html, /<p>flowchart/);
});

test("bulleted list becomes <li>", () => {
	const html = textileToPreviewHtml("* 第一項\n* 第二項\n");
	assert.match(html, /<li>/);
	assert.match(html, /第一項/);
	assert.match(html, /第二項/);
});

test("collapse block is preserved", () => {
	const html = textileToPreviewHtml("{{collapse(path)\n內文\n}}\n");
	assert.match(html, /<details>/);
	assert.match(html, /path/);
});

test("pre/code block is preserved", () => {
	const html = textileToPreviewHtml('<pre><code class="shell">\necho hi\n</code></pre>\n');
	assert.match(html, /<code/);
	assert.match(html, /echo hi/);
});
