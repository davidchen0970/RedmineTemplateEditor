import { test } from "node:test";
import assert from "node:assert/strict";
import {
	ensureUiState,
	isCollapsed,
	normalizeBlockLevel,
	getMaxBlockLevel,
} from "../../src/ui/editor/ui-state.js";

test("uiState: normalizeBlockLevel floors and floors the value", () => {
	assert.equal(normalizeBlockLevel(2.9), 2);
	assert.equal(normalizeBlockLevel(3.0), 3);
});

test("uiState: normalizeBlockLevel clamps below 1 to 1", () => {
	assert.equal(normalizeBlockLevel(0), 1);
	assert.equal(normalizeBlockLevel(-5), 1);
});

test("uiState: normalizeBlockLevel clamps above maxLevel to maxLevel", () => {
	assert.equal(normalizeBlockLevel(3, 2), 2);
	assert.equal(normalizeBlockLevel(10, 4), 4);
});

test("uiState: normalizeBlockLevel falls back to 1 for non-finite input", () => {
	assert.equal(normalizeBlockLevel("abc"), 1);
	assert.equal(normalizeBlockLevel(undefined), 1);
	assert.equal(normalizeBlockLevel(Infinity), 1);
	assert.equal(normalizeBlockLevel(NaN), 1);
});

test("uiState: normalizeBlockLevel with Infinity max passes real levels through", () => {
	assert.equal(normalizeBlockLevel(4, Infinity), 4);
});

test("uiState: getMaxBlockLevel is 1 at index 0", () => {
	const section = { blocks: [{ level: 3 }] };
	assert.equal(getMaxBlockLevel(section, 0), 1);
});

test("uiState: getMaxBlockLevel is the previous block level plus one", () => {
	const section = { blocks: [{ level: 3 }] };
	assert.equal(getMaxBlockLevel(section, 1), 4);
	assert.equal(getMaxBlockLevel({ blocks: [{ level: 1 }] }, 1), 2);
});

test("uiState: getMaxBlockLevel treats a malformed previous level as level 1", () => {
	assert.equal(getMaxBlockLevel({ blocks: [{ level: "bogus" }] }, 1), 2);
	assert.equal(getMaxBlockLevel({ blocks: [] }, 2), 2);
});

test("uiState: ensureUiState builds the nested collapse map and returns state.ui", () => {
	const state = {};
	const ui = ensureUiState(state);
	assert.ok(ui.collapsed);
	assert.ok(ui.collapsed.sections && typeof ui.collapsed.sections === "object");
	assert.ok(ui.collapsed.blocks && typeof ui.collapsed.blocks === "object");
});

test("uiState: ensureUiState preserves existing collapse entries", () => {
	const state = { ui: { collapsed: { sections: { s1: true } } } };
	const ui = ensureUiState(state);
	assert.equal(ui.collapsed.sections.s1, true);
	assert.ok(ui.collapsed.blocks);
});

test("uiState: isCollapsed reads the right scope and falls back to default", () => {
	const state = { ui: { collapsed: { sections: { s1: true }, blocks: {} } } };
	assert.equal(isCollapsed(state, "sections", "s1"), true);
	assert.equal(isCollapsed(state, "blocks", "b1"), false);
	assert.equal(isCollapsed(state, "blocks", "b1", true), true);
});
