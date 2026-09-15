import { test } from "node:test";
import assert from "node:assert/strict";
import {
	COLOR_PROP,
	BACKGROUND_PROP,
	buildStyleSpan,
	setStyleProperty,
	removeStyleProperty,
	findStyleSpan,
} from "../../src/ui/formatting/inline-styles.js";

test("buildStyleSpan: omits the %{…} wrapper when there is no style", () => {
	assert.equal(buildStyleSpan("", "plain text"), "plain text");
});

test("buildStyleSpan: wraps styled content", () => {
	assert.equal(buildStyleSpan("color:red", "word"), "%{color:red}word%");
});

test("setStyleProperty: adds a property to empty style text", () => {
	assert.equal(setStyleProperty("", COLOR_PROP, "red"), "color:red");
});

test("setStyleProperty: merges with existing properties", () => {
	const out = setStyleProperty("color:red; background:yellow", COLOR_PROP, "blue");
	assert.ok(out.includes("color:blue"));
	assert.ok(out.includes("background:yellow"));
});

test("setStyleProperty: normalises background-color alias", () => {
	assert.equal(setStyleProperty("", "background-color", "green"), BACKGROUND_PROP + ":green");
});

test("removeStyleProperty: drops a property and keeps others", () => {
	const out = removeStyleProperty("color:red; background:yellow", COLOR_PROP);
	assert.ok(!out.includes("color"));
	assert.ok(out.includes("background:yellow"));
});

test("findStyleSpan: finds a span whose content contains the selection", () => {
	// "%{color:red}text%" — content "text" runs at 12..16 in the full string.
	const value = "%{color:red}text%";
	const contentStart = "%{color:red}".length; // 12: after the "%{...}" head
	const match = findStyleSpan(value, contentStart, contentStart + "text".length);
	assert.ok(match);
	assert.equal(match.inner, "text");
	assert.equal(match.styleText, "color:red");
	assert.equal(match.matchStart, 0);
	assert.equal(match.contentStart, contentStart);
});

test("findStyleSpan: returns null when outside any span", () => {
	assert.equal(findStyleSpan("no markers here", 0, 2), null);
});
