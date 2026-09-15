import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCodeWrap, clearCodeWrap, findCodeRange } from "../../src/ui/formatting/code-markers.js";

test("findCodeRange: returns null when no code span matches", () => {
	assert.equal(findCodeRange("plain text", 0, 5), null);
});

test("findCodeRange: locates the span containing the caret", () => {
	const range = findCodeRange("before @api.c@ after", 7, 12);
	assert.ok(range);
	assert.equal(range.inner, "api.c");
	assert.equal(range.matchStart, 7); // span "@api.c@" begins right after "before "
	assert.equal(range.matchEnd, 7 + "@api.c@".length);
});

test("applyCodeWrap: wraps a plain selection", () => {
	const out = applyCodeWrap("do work", 3, 7);
	assert.deepEqual(out, { value: "do @work@", start: 3, end: 9 });
});

test("applyCodeWrap: keeps a whole @api@ selection unchanged", () => {
	// "a @api@ b", selecting content (3..6) stays @api@, caret back on markers.
	const out = applyCodeWrap("a @api@ b", 3, 6);
	assert.equal(out.value, "a @api@ b");
	assert.equal(out.value.match(/@@/g), null, "no doubled markers");
});

test("applyCodeWrap: wraps an inner selection of an existing span keeping sides", () => {
	// Selecting "second" (7..13) of "@first second@" → "@first @ @second@"-style:
	// the selection gets its own markers and no character is dropped or duplicated.
	const out = applyCodeWrap("@first second@", 7, 13);
	assert.ok(out.value.includes("first"), "the code side is preserved");
	assert.ok(out.value.includes("@second@"), "the selection gets its own code marker");
	assert.equal(out.value.replace(/@/g, ""), "first second");
});

test("applyCodeWrap: returns null for an empty selection", () => {
	assert.equal(applyCodeWrap("abc", 1, 1), null);
});

test("clearCodeWrap: clears a full code span", () => {
	// "see @api.c@ ok", selecting the content (5..10) → "see api.c ok".
	const out = clearCodeWrap("see @api.c@ ok", 5, 10);
	assert.equal(out.value, "see api.c ok");
});

test("clearCodeWrap: unmarks part of a span keeping the content", () => {
	// "@first second@", selecting "first" (1..6) → "first@ second@"-style: the
	// "first" markers are removed; no character is dropped or duplicated.
	const out = clearCodeWrap("@first second@", 1, 6);
	assert.equal(out.value.replace(/@/g, ""), "first second");
});

test("clearCodeWrap: strips whole spans inside an unmarked selection", () => {
	// "x @a@ y @b@", selecting "@a@ y" (2..7) → "x a y @b@".
	const out = clearCodeWrap("x @a@ y @b@", 2, 7);
	assert.equal(out.value, "x a y @b@");
});

test("clearCodeWrap: returns null for an empty selection", () => {
	assert.equal(clearCodeWrap("abc", 1, 1), null);
});
