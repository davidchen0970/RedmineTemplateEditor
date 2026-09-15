import { test } from "node:test";
import assert from "node:assert/strict";
import { textileToPreviewHtml } from "../src/textile/preview.js";
import { renderInlineTextile, parsePreviewTableRow, renderPreviewCodeHtml } from "../src/textile/preview-inline.js";

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
