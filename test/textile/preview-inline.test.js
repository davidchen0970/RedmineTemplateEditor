import { test } from "node:test";
import assert from "node:assert/strict";
import {
	parsePreviewTableRow,
	registerPreviewImage,
	renderDiffPreview,
	renderInlineTextile,
	renderPreviewCodeHtml,
	renderPreviewImage,
} from "../../src/textile/preview-inline.js";

test("renderInlineTextile keeps @code@ as <code>", () => {
	assert.equal(renderInlineTextile("run @ls -l@"), 'run <code>ls -l</code>');
});

test("renderInlineTextile turns *bold* into <strong>", () => {
	assert.equal(renderInlineTextile("*bold*"), "<strong>bold</strong>");
});

test("renderInlineTextile turns \"label\":url into a link", () => {
	const html = renderInlineTextile('"openocd":https://doc.example/x');
	assert.match(html, /<a href="https:\/\/doc\.example\/x"/);
	assert.match(html, /openocd<\/a>/);
	assert.match(html, /rel="noopener noreferrer"/);
});

test("renderInlineTextile resolves registered images", () => {
	registerPreviewImage("shot", "data:image/png;base64,AAA");
	const html = renderInlineTextile("!shot!");
	assert.match(html, /<img class="preview-image"/);
	assert.match(html, /data-preview-name="shot"/);
});

test("renderPreviewImage with a blank name returns nothing", () => {
	assert.equal(renderPreviewImage("   "), "");
});

test("renderPreviewCodeHtml strips code tags and escapes content", () => {
	const html = renderPreviewCodeHtml("<code>a & b</code>");
	assert.match(html, /a &amp; b/);
});

test("renderPreviewCodeHtml forces dark text on bright background inside pre", () => {
	const html = renderPreviewCodeHtml("%{background:lightgreen}hi%");
	assert.match(html, /background:lightgreen/);
	assert.match(html, /color:#1f2328/);
});

test("renderDiffPreview tags added(+) and removed(-) lines", () => {
	const html = renderDiffPreview("+new-line\n-old-line");
	assert.match(html, /diff-added/);
	assert.match(html, /diff-removed/);
	assert.match(html, /new-line/);
	assert.match(html, /old-line/);
});

test("renderDiffPreview also parses hunk headers", () => {
	const html = renderDiffPreview("@@ -1,2 +3,4 @@\n+a\n-b\n context");
	assert.match(html, /diff-hunk/);
	assert.match(html, /diff-added/);
	assert.match(html, /diff-removed/);
	assert.match(html, /diff-line-number/);
});

test("parsePreviewTableRow renders plain cells as td", () => {
	const html = parsePreviewTableRow("|a|b|");
	assert.match(html, /<td>a<\/td>/);
	assert.match(html, /<td>b<\/td>/);
});

test("parsePreviewTableRow renders a header row as th", () => {
	const html = parsePreviewTableRow("|_. head|body|");
	assert.match(html, /<th>head<\/th>/);
	assert.match(html, /<th>body<\/th>/);
});

test("parsePreviewTableRow respects a \\N colspan header", () => {
	const html = parsePreviewTableRow("|_\\2. 標題|內容|");
	assert.match(html, /<th colspan="2">標題<\/th>/);
	assert.match(html, /<th>內容<\/th>/);
});

test("parsePreviewTableRow maps < align to a text-align style", () => {
	const html = parsePreviewTableRow("|<. 左|b|");
	assert.match(html, /style="text-align:left"/);
});
