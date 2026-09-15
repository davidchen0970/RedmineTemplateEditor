import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

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
