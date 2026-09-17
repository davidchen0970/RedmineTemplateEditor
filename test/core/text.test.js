import { test } from "node:test";
import assert from "node:assert/strict";

test("text: escapeHtml escapes the textile-hazardous characters", async () => {
	const escapeHtml = (await import("../../src/core/text.js")).escapeHtml;
	assert.equal(escapeHtml(`a<b>&c"d`), "a&lt;b&gt;&amp;c&quot;d");
	assert.equal(escapeHtml("plain"), "plain");
	// Non-string input is coerced, null becomes "". 
	assert.equal(escapeHtml(null), "");
	assert.equal(escapeHtml(undefined), "");
});

test("text: toNonEmptyTrimmedLines trims blanks and drops empty lines", async () => {
	const { toNonEmptyTrimmedLines } = await import("../../src/core/text.js");
	assert.deepEqual(toNonEmptyTrimmedLines("  a \n\n  b \n  "), ["a", "b"]);
	assert.deepEqual(toNonEmptyTrimmedLines(""), []);
	assert.deepEqual(toNonEmptyTrimmedLines("  \n  \n"), []);
});

test("text: safe() munges a filename to an 80-char safe slug", async () => {
	const { safe } = await import("../../src/core/text.js");
	assert.equal(safe("a/b\\c:d*e?f\"g<h>i|j k"), "a_b_c_d_e_f_g_h_i_j_k");
	assert.equal(safe("x".repeat(200)).length, 80);
	assert.equal(safe(""), "redmine-note");
});
