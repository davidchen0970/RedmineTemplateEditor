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
