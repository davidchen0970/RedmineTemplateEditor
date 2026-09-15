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
