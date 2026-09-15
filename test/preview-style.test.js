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

import { normalizePreviewCssColor, parsePreviewColorRgb, isHighBrightnessBackground } from "../src/textile/preview-style.js";


test("normalizePreviewCssColor keeps only a safe colour charset", () => {
	assert.equal(normalizePreviewCssColor(" rgb(10,20,30) "), "rgb(10,20,30)");
	assert.equal(normalizePreviewCssColor("#ff00aa"), "#ff00aa");
	assert.equal(normalizePreviewCssColor("url(javascript:alert(1))"), "url(javascriptalert(1))");
});

test("normalizePreviewCssStyle rejects non-property declarations and empty values", () => {
	assert.equal(normalizePreviewCssStyle("color: red; font-some: none; 12px: x"), "color:red; font-some:none");
	assert.equal(normalizePreviewCssStyle("color : red"), "color:red");
	assert.equal(normalizePreviewCssStyle("color:;"), "");
	assert.equal(normalizePreviewCssStyle(";;;"), "");
});

test("parsePreviewColorRgb understands css3 colours but not rgba hex or urls", () => {
	assert.deepEqual(parsePreviewColorRgb("red"), [255, 0, 0]);
	assert.deepEqual(parsePreviewColorRgb("#0f0"), [0, 255, 0]);
	assert.deepEqual(parsePreviewColorRgb("#ffffff"), [255, 255, 255]);
	assert.deepEqual(parsePreviewColorRgb("rgb(10,20,30)"), [10, 20, 30]);
	assert.equal(parsePreviewColorRgb("transparent"), null);
	assert.equal(parsePreviewColorRgb("#fff0"), null); // 4-digit rgba hex is unsupported
	assert.equal(parsePreviewColorRgb(""), null);
});

test("hsl percent colours map into rgb space", () => {
	const rgb = parsePreviewColorRgb("hsl(120, 100%, 50%)");
	assert.equal(rgb.length, 3);
	assert.deepEqual(rgb, [0, 255, 0]);
});

test("isHighBrightnessBackground flags light backgrounds", () => {
	assert.equal(isHighBrightnessBackground("background:#ffffff"), true);
	assert.equal(isHighBrightnessBackground("background:#111111"), false);
	assert.equal(isHighBrightnessBackground("background:yellow; color:red"), true);
	assert.equal(isHighBrightnessBackground("color:red"), false);
});

test("renderPreviewTextileStyleSpans forces dark text only on bright backgrounds lacking a color", () => {
	assert.equal(renderPreviewTextileStyleSpans("%{background:yellow}hi%"), "<span style=\"background:yellow; color:#1f2328\">hi</span>");
	assert.equal(renderPreviewTextileStyleSpans("%{background:black}hi%"), "<span style=\"background:black\">hi</span>");
	assert.equal(renderPreviewTextileStyleSpans("%{color:red}hi%"), "<span style=\"color:red\">hi</span>");
});

test("renderPreviewTextileStyleSpans keeps any well-formed property:value span", () => {
	assert.equal(renderPreviewTextileStyleSpans("%{foo:bar}hi%"), "<span style=\"foo:bar\">hi</span>");
});

test("renderPreviewTextileStyleSpans keeps multiple valid spans", () => {
	const out = renderPreviewTextileStyleSpans("%{color:green}G%{%{color:red}R%");
	assert.match(out, /color:green/);
	assert.match(out, /color:red/);
});
