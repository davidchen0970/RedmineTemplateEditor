import { test } from "node:test";
import assert from "node:assert/strict";
import { reorderOffset } from "../src/ui/motion/card-slide.js";

test("reorderOffset for a card that moved down slides to the old top", () => {
	assert.equal(reorderOffset(100, 200), -100);
});

test("reorderOffset for a card that moved up slides to the old top", () => {
	assert.equal(reorderOffset(200, 100), 100);
});

test("reorderOffset is 0 when the card did not move", () => {
	assert.equal(reorderOffset(100, 100), 0);
});

test("reorderOffset guards non-finite geometry", () => {
	assert.equal(reorderOffset(NaN, 100), 0);
	assert.equal(reorderOffset(100, undefined), 0);
});
