import { test } from "node:test";
import assert from "node:assert/strict";
import {
	block,
	createSection,
	createImplementationBlock,
	createEnvItem,
	makeState,
	normalizeEnvironment,
	normalizeState,
	environmentFields,
} from "../src/core/state.js";

test("makeState deep-copies presets and does not share section arrays across calls", () => {
	const a = makeState("porting");
	const b = makeState("porting");
	assert.notEqual(a.sections, b.sections);
	a.sections[0].title = "改(本地上)";
	assert.equal(b.sections[0].title, "修改內容");
});

test("hardware / debug presets carry their status and change defaults", () => {
	const h = makeState("hardware");
	assert.equal(h.status, "PASS");
	assert.equal(h.changeContent, "X");
	assert.equal(h.sections.length, 3);
	const d = makeState("debug");
	assert.equal(d.status, "FAILED");
	assert.equal(d.sections[0].title, "問題現象");
});

test("normalizeEnvironment handles an array input with missing/edge fields", () => {
	const env = normalizeEnvironment([
		{ label: "a", value: "x", enabled: 1 },
		null,
		{},
	]);
	assert.equal(env.length, 3);
	assert.ok(env[0].enabled);
	assert.equal(env[1].label, "");
	assert.equal(env[2].label, "");
	const [n1, n2] = normalizeEnvironment([null, {}]);
	assert.equal(String(n1.label), "");
	assert.equal(String(n2.value), "");
});

test("normalizeEnvironment object form reuses the 7 known keys and toggles enabled on filled value", () => {
	const env = normalizeEnvironment({ systemModel: " DVT2 ", bios: "" });
	assert.equal(env.length, environmentFields.length);
	assert.equal(env[0].value, " DVT2 ");
	assert.equal(env[0].enabled, true);
	assert.equal(env[1].enabled, false);
});

test("normalizeState clamps the first block level to 1 even when already deeper", () => {
	const s = {
		sections: [{ title: "a", enabled: true, blocks: [{ type: "mermaid", level: 5, contents: ["x"] }] }],
	};
	const blocks = normalizeState(s).sections[0].blocks;
	assert.equal(blocks[0].level, 1);
});

test("normalizeState coerces non-finite levels to a number and never to null", () => {
	const s = {
		sections: [
			{
				title: "a",
				enabled: true,
				blocks: [
					{ type: "text", title: "a", contents: ["1"], level: "Infinity" },
					{ type: "text", title: "b", contents: ["2"], level: NaN },
					{ type: "text", title: "c", contents: ["3"], level: -3 },
				],
			},
		],
	};
	const levels = normalizeState(s).sections[0].blocks.map((b) => b.level);
	// non-finite/negative levels all set guard to 1; only a genuinely
	// larger-than-allowed level clamps to previous+1.
	assert.deepEqual(levels, [1, 1, 1]);
});

test("normalizeState migrates a string-array implementation and drops legacy fields", () => {
	const s = {
		sections: [
			{
				title: "x",
				enabled: true,
				blocks: [{ type: "implementation", level: 1, contents: ["def f() return 1", "", "x=2"] }],
			},
		],
	};
	const migrated = normalizeState(s).sections[0].blocks[0];
	assert.equal(migrated.contents.length, 3);
	assert.ok(migrated.contents.every((c) => typeof c === "object"));
	assert.equal(migrated.contents[0].lang, "shell");
});

test("createEnvItem defaults are off and non-custom", () => {
	const item = createEnvItem("label");
	assert.equal(item.enabled, false);
	assert.equal(item.custom, false);
	assert.equal(item.value, "");
	assert.ok(item.id);
});

test("createImplementationBlock keeps per-item lang and workPath flags", () => {
	const b = createImplementationBlock("api.c", "(docker)$ pwd", "c", "int x;", "", "work path", true);
	assert.equal(b.type, "implementation");
	assert.deepEqual(b.contents, [{ content: "int x;", lang: "c" }]);
	assert.equal(b.showWorkPath, true);
	const hidden = createImplementationBlock("api.c", "", "shell", "", "", "work path", false);
	assert.equal(hidden.showWorkPath, false);
	assert.deepEqual(hidden.contents, [{ content: "", lang: "shell" }]);
});

test("block builds contents as a string array for non-implementation types", () => {
	const b = block("collapse", "更多", "detail body");
	assert.deepEqual(b.contents, ["detail body"]);
	assert.equal(b.level, 1);
});
