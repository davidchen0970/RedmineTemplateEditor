import { test } from "node:test";
import assert from "node:assert/strict";
import {
	registerPreviewImage,
	renderDiffPreview,
	renderInlineTextile,
	renderPreviewCodeHtml,
	parsePreviewTableRow,
} from "../src/textile/preview-inline.js";

test("renderInlineTextile keeps @code@ as <code>", () => {
	assert.equal(renderInlineTextile("run @ls -l@"), 'run <code>ls -l</code>');
});

test("renderInlineTextile turns *bold* into <strong>", () => {
	assert.equal(renderInlineTextile("*bold*"), "<strong>bold</strong>");
});

test("renderInlineTextile resolves registered images", () => {
	registerPreviewImage("shot", "data:image/png;base64,AAA");
	const html = renderInlineTextile("!shot!");
	assert.match(html, /<img class="preview-image"/);
	assert.match(html, /data-preview-name="shot"/);
});

test("renderPreviewCodeHtml strips code tags and escapes content", () => {
	const html = renderPreviewCodeHtml("<code>a & b</code>");
	assert.match(html, /a &amp; b/);
});

test("renderDiffPreview tags added(+) and removed(-) lines", () => {
	const html = renderDiffPreview("+new-line\n-old-line");
	assert.match(html, /diff-added/);
	assert.match(html, /diff-removed/);
	assert.match(html, /new-line/);
	assert.match(html, /old-line/);
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
