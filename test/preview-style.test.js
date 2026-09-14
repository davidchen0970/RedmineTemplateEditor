import { test } from "node:test";
import assert from "node:assert/strict";
import {
	normalizePreviewCssStyle,
	renderPreviewTextileStyleSpans,
} from "../src/textile/preview-style.js";

test("bright hex background gets a forced dark text color", () => {
	const html = renderPreviewTextileStyleSpans("%{background:#fff}hi%");
	assert.match(html, /background:#fff/);
	assert.match(html, /color:#1f2328/);
});

test("bright rgb background gets a forced dark text color", () => {
	const html = renderPreviewTextileStyleSpans("%{background:rgb(255,255,220)}hi%");
	assert.match(html, /color:#1f2328/);
});

test("bright background with explicit color keeps the author color", () => {
	const html = renderPreviewTextileStyleSpans("%{background:#ffffff; color:#004488}hi%");
	assert.match(html, /color:#004488/);
	assert.doesNotMatch(html, /#1f2328/);
});

test("dark background is left as-is", () => {
	const html = renderPreviewTextileStyleSpans("%{background:#111}hi%");
	assert.match(html, /background:#111/);
	assert.doesNotMatch(html, /color:#1f2328/);
});

test("named bright background (yellow) gets a forced dark text color", () => {
	const html = renderPreviewTextileStyleSpans("%{background:yellow}hi%");
	assert.match(html, /background:yellow/);
	assert.match(html, /color:#1f2328/);
});

test("lightgreen is treated as bright and gets a dark text", () => {
	const html = renderPreviewTextileStyleSpans("%{background:lightgreen}hi%");
	assert.match(html, /color:#1f2328/);
});

test("lightseagreen is dark, no forced color", () => {
	const html = renderPreviewTextileStyleSpans("%{background:lightseagreen}hi%");
	assert.doesNotMatch(html, /color:#1f2328/);
});

test("text without background is left as-is", () => {
	const html = renderPreviewTextileStyleSpans("%{color:red}hi%");
	assert.match(html, /color:red/);
	assert.doesNotMatch(html, /#1f2328/);
});

test("shorthand hex bright background gets a forced dark text color", () => {
	const html = renderPreviewTextileStyleSpans("%{background:#abc}x%");
	assert.match(html, /color:#1f2328/);
});

test("hsl bright background gets a forced dark text color", () => {
	const html = renderPreviewTextileStyleSpans("%{background:hsl(120,100%,85%)}x%");
	assert.match(html, /color:#1f2328/);
});

test("rgba transparent background is left as-is", () => {
	const html = renderPreviewTextileStyleSpans("%{background:transparent}hi%");
	assert.doesNotMatch(html, /#1f2328/);
});

test("normalizePreviewCssStyle strips the javascript: scheme", () => {
	const style = normalizePreviewCssStyle("background:url(javascript:alert(1))");
	assert.doesNotMatch(style, /javascript:/);
});

test("normalizePreviewCssStyle rejects invalid declarations", () => {
	assert.equal(normalizePreviewCssStyle("junk; color:red"), "color:red");
	assert.equal(normalizePreviewCssStyle(" ; "), "");
});
