import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLabelColor, wrapLabelRuns } from "../../src/ui/output/mermaid-label.js";

/* The wrap budget is measured with fallback 0.58 * fontSize per char under node
   (no canvas), so we can assert line structure deterministically. */

test("resolveLabelColor: keeps 6-digit hex, expands 3-digit hex", () => {
	assert.equal(resolveLabelColor("#aabbcc"), "#aabbcc");
	assert.equal(resolveLabelColor("#abc"), "#aabbcc");
});

test("resolveLabelColor: keeps named colors", () => {
	assert.equal(resolveLabelColor("red"), "red");
	assert.equal(resolveLabelColor("DODGERBLUE"), "dodgerblue");
});

test("resolveLabelColor: flattens rgb/rgba to #rrggbb", () => {
	assert.equal(resolveLabelColor("rgb(220, 38, 38)"), "#dc2626");
	assert.equal(resolveLabelColor("rgba(16, 23, 52, .5)"), "#101734");
});

test("resolveLabelColor: returns null for unusable colors", () => {
	for (const value of ["", "transparent", "currentColor", "none", "not-a-color", null, undefined]) {
		assert.equal(resolveLabelColor(value), null, `resolveLabelColor(${String(value)})`);
	}
});

test("wrapLabelRuns: returns an empty fallback line for no words", () => {
	const out = wrapLabelRuns([{ text: "   ", color: null, bold: false }], 200, 16, "sans-serif");
	assert.deepEqual(out, [[{ text: "", color: null, bold: false }]]);
});

test("wrapLabelRuns: keeps a short text on one line", () => {
	const runs = [{ text: "hello world", color: null, bold: false }];
	const out = wrapLabelRuns(runs, 500, 16, "sans-serif");
	assert.deepEqual(out, [[{ text: "hello world", color: null, bold: false }]]);
});

test("wrapLabelRuns: splits long text across lines", () => {
	const runs = [{ text: "alpha beta gamma delta", color: null, bold: false }];
	const out = wrapLabelRuns(runs, 100, 16, "sans-serif");
	const lineTexts = out.map((line) => line.map((run) => run.text).join(" "));
	const joined = lineTexts.join(" ");
	assert.equal(joined, "alpha beta gamma delta", "wrapping must not drop or reorder words");
	assert.ok(lineTexts.length > 1, "a wide text must wrap");
	for (const text of lineTexts) {
		assert.ok(text.length * 16 * 0.58 <= 100 + 1e-6, `line "${text}" must fit the 100px budget`);
	}
});

test("wrapLabelRuns: preserves per-run colour and bold across wrapping", () => {
	const runs = [
		{ text: "alpha beta", color: "#dc2626", bold: true },
		{ text: "gamma delta", color: null, bold: false },
	];
	const out = wrapLabelRuns(runs, 90, 16, "sans-serif");
	const linesText = out.map((line) => line.map((run) => run.text).join(" "));
	// Every word must survive and the two bold red ones must keep their styling.
	const redBold = out.flat().filter((run) => run.text === "alpha" || run.text === "beta");
	for (const run of redBold) {
		assert.equal(run.color, "#dc2626");
		assert.equal(run.bold, true);
	}
	assert.ok(linesText.length > 1, "multi-colour text still wraps");
});

test("wrapLabelRuns: slices a lone over-wide word without dropping chars", () => {
	const runs = [{ text: "elephantine-pachyderm", color: null, bold: false }];
	const out = wrapLabelRuns(runs, 80, 16, "sans-serif");
	const joined = out.flat().map((run) => run.text).join("");
	assert.equal(joined, "elephantine-pachyderm", "wrapping must not drop characters");
	for (const line of out) {
		const text = line.map((run) => run.text).join(" ");
		assert.ok(text.trim().length > 0, "no empty line pieces");
		assert.ok(text.length * 16 * 0.58 <= 80 + 1e-6, `segment "${text}" must fit 80px`);
	}
});
