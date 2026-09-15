import { test } from "node:test";
import assert from "node:assert/strict";
import { textileToPreviewHtml } from "../../src/textile/preview.js";

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

test("inline style span %{color:red}text% becomes a <span>", () => {
	const html = textileToPreviewHtml("hello %{color:red}紅% world\n");
	assert.match(html, /<span style="color:red">/);
	assert.match(html, /紅/);
});

test("mermaid fence content is collected into the host", () => {
	const html = textileToPreviewHtml("{{mermaid\nflowchart LR\nA-->B\n}}\n");
	assert.match(html, /class="mermaid"/);
	assert.match(html, /data-mermaid-source="flowchart LR/);
	assert.match(html, /A--&gt;B/);
	assert.doesNotMatch(html, /<p>flowchart/);
});

test("an unclosed mermaid fence still flushes at the end", () => {
	const html = textileToPreviewHtml("{{mermaid\nA-->B\n");
	assert.match(html, /class="mermaid"/);
});

test("bulleted list becomes <li>", () => {
	const html = textileToPreviewHtml("* 第一項\n* 第二項\n");
	assert.match(html, /<li>/);
	assert.match(html, /第一項/);
	assert.match(html, /第二項/);
});

test("ordered list renders an <ol>", () => {
	const html = textileToPreviewHtml("# 第一項\n# 第二項\n");
	assert.match(html, /<ol>/);
	assert.match(html, /<li>第一項/);
});

test("nested bullet creates a nested <ul>", () => {
	const html = textileToPreviewHtml("* a\n** b\n");
	assert.equal((html.match(/<ul>/g) || []).length, 2);
	assert.match(html, /<li>b/);
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

test("diff code block renders a rich diff view", () => {
	const html = textileToPreviewHtml('<pre><code class="diff">\n@@ -1 +1 @@\n+a\n-b\n context\n</code></pre>\n');
	assert.match(html, /diff-preview/);
	assert.match(html, /diff-hunk/);
	assert.match(html, /diff-added/);
	assert.match(html, /diff-removed/);
});

test("plain heading text wraps in a <p>", () => {
	const html = textileToPreviewHtml("hello world\n");
	assert.match(html, /<p>/);
	assert.match(html, /hello world/);
});

test("empty input renders the empty-preview note", () => {
	assert.match(textileToPreviewHtml(""), /尚無可預覽內容/);
});

test("a standalone !image! line renders an <img> without throwing", () => {
	const html = textileToPreviewHtml("!diagram.png!\n");
	assert.match(html, /<img class="preview-image"/);
	assert.match(html, /data-preview-name="diagram.png"/);
	assert.match(html, /src="diagram.png"/);
});

import { renderInlineTextile, parsePreviewTableRow, renderPreviewCodeHtml } from "../../src/textile/preview-inline.js";


const render = (textileText) => textileToPreviewHtml("\n" + textileText + "\n");

test("textile link uses opener-link href and no-opener attrs", () => {
	const out = render('"官方網頁":https://redmine.example/x');
	assert.match(out, /<a href="https:\/\/redmine\.example\/x" target="_blank" rel="noopener noreferrer">官方網頁<\/a>/);
});

test("only http(s) links are made clickable; ftp scheme stays text", () => {
	const out = render('"連結":ftp://example.com');
	// ftp scheme must NOT become an <a>
	assert.doesNotMatch(out, /<a href="ftp/);
});

test("raw HTML event attributes from a textile line are not passed through", () => {
	const out = render('<script>alert(1)</script>');
	assert.doesNotMatch(out, /<script>/i);
	assert.doesNotMatch(out, /onerror=/i);
});

test("nested bullet list builds nested <ul>", () => {
	const out = textileToPreviewHtml("\n* a\n** b\n");
	// proper HTML nests the inner <ul> inside the <li>
	assert.match(out, /<li>a\s*<ul>\s*<li>b\s*<\/li>\s*<\/ul>\s*<\/li>/);
});

test("an ordered-bullet mix closes lists correctly", () => {
	const out = textileToPreviewHtml("\n* one\n# two\n");
	assert.match(out, /<\/ul>[\s\S]*<ol>/);
});

test("table with a declared width keeps the style but drops unsafe chunks", () => {
	const out = textileToPreviewHtml('\ntable{width:100%}. \n|a|b|\n');
	assert.match(out, /<table class="preview-table" style="width:100%">/);
});

test("a bare code fence is HTML-escaped inside <pre><code>", () => {
	const out = render("<pre><code>if (a < b) console.log('&amp;')</code></pre>");
	assert.match(out, /&lt;/);
	assert.doesNotMatch(out, /<code>if \(a </);
});

test("unclosed collapse still flushes its body at the end", () => {
	const out = textileToPreviewHtml("\n{{collapse(附錄)\n內容 a\n");
	assert.match(out, /<details>[\s\S]*內容 a/);
	assert.match(out, /附錄/);
});

test("CRLF and lone CR are normalised to LF", () => {
	const out = textileToPreviewHtml("h2. X\r\nbody one\r body two\r\n");
	assert.match(out, /<h2>/);
	assert.match(out, /body two/);
});

test("double-asterisk emphasis keeps a single pair of strong the same as textile", () => {
	// **bold** must become *<strong>bold</strong>*, not <strong><strong>
	const out = renderInlineTextile("**bold**");
	assert.match(out, /^\*<strong>bold<\/strong>\*$/);
});

test("renderInlineTextile escapes angle brackets from plain text", () => {
	assert.equal(renderInlineTextile("<2 & 3"), "&lt;2 &amp; 3");
});

test("renderPreviewCodeHtml strips rogue closing/opening code tags but escapes the rest", () => {
	assert.equal(renderPreviewCodeHtml("</code>x < y<code>"), "x &lt; y");
});

test("table cell head parses col/row span and highligh", () => {
	const row = parsePreviewTableRow("|\\2.a|/2.b|_.h|c|");
	assert.match(row, /colspan="2"/);
	assert.match(row, /rowspan="2"/);
	assert.ok(row.includes("<th"));
});

test("image spelling normalisation: a bare image line becomes <img>", () => {
	const out = render("!screenshot.png!");
	assert.match(out, /<img[^>]*class="preview-image"/);
});
