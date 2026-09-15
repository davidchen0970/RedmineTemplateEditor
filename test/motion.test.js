import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { segmentedIndicatorPosition } from "../src/ui/output-view.js";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "../assets/styles/motion.css");
const css = readFileSync(cssPath, "utf8");

test("output view panes cross-fade via mo-fade when shown", () => {
	assert.match(
		css,
		/\.output:not\(\.hidden\)\s*,\s*\.redmine-preview:not\(\.hidden\)\s*\{\s*animation:\s*mo-fade\s+var\(--mo\)/
	);
});

test("output panel title rises in once with a small h2 stagger", () => {
	assert.match(
		css,
		/\.output-title \.eyebrow\s*,\s*\.output-title h2\s*\{[\s\S]*?animation:\s*mo-rise/
	);
	assert.match(css, /\.output-title h2\s*\{[\s\S]*?animation-delay:\s*60ms/);
});

test("header localStorage controls ease on hover and focus", () => {
	assert.match(
		css,
		/\.add-block-dialog \.actions input:focus\s*\{[\s\S]*?box-shadow:\s*0 0 0 3px var\(--soft\)/
	);
	assert.match(
		css,
		/\.add-block-dialog \.actions input:hover\s*\{[\s\S]*?transform:\s*translateY\(-1px\)/
	);
	assert.match(css, /\.storage-actions select:focus,/);
});

test("template cards lift on hover and press down", () => {
	assert.match(css, /\.card:active\s*\{[\s\S]*?transform:\s*scale\(0\.985\)/);
	assert.match(css, /\.card\s*\{[^{}]*transition:[^{}]*var\(--mo-fast\)/);
	assert.match(css, /\.card:hover\s*\{[\s\S]*?box-shadow:\s*0 6px 14px/);
});

test("preview links, summaries and pick images ease on hover", () => {
	assert.match(
		css,
		/\.redmine-preview img\.preview-image-pick:hover\s*\{[\s\S]*?transform:\s*scale\(1\.05\)/
	);
	assert.match(css, /\.redmine-preview summary:hover\s*\{[\s\S]*?color:\s*var\(--primary\)/);
	assert.match(css, /\.redmine-preview a\s*\{[^{}]*transition:\s*color/);
});

test("block bodies collapse by animating height", () => {
	assert.match(css, /\.block-collapsible\s*\{[^{}]*transition:[\s\S]*?height var\(--mo-slow\)/);
	assert.match(css, /\.block-collapsible\[hidden\]\s*\{[\s\S]*?\bdisplay:\s*block/);
	assert.match(css, /\.block-collapsible\[hidden\]\s*\{[\s\S]*?\bheight:\s*0;/);
});

test("the sliding tab indicator rides under the active tab", () => {
	assert.match(css, /\.segmented::after\s*\{[\s\S]*?width:\s*var\(--seg-w/);
	assert.match(css, /\.segmented::after\s*\{[\s\S]*?transition:[\s\S]*?\bleft\s+var\(--mo-slow\)[\s\S]*?\bwidth\s+var\(--mo-slow\)/);
});

test("segmentedIndicatorPosition maps the active tab rect", () => {
	assert.deepEqual(segmentedIndicatorPosition({ left: 40 }, { left: 152, width: 84 }), { left: 112, width: 84 });
	assert.deepEqual(segmentedIndicatorPosition({ left: 12 }, { left: 0, width: 60 }), { left: -12, width: 60 });
});
