import { test } from "node:test";
import assert from "node:assert/strict";
import {
	block,
	createSection,
	escapeHtml,
	makeState,
	normalizeState,
	safe,
	toNonEmptyTrimmedLines,
} from "../src/core/state.js";

test("escapeHtml escapes &, <, >, and quotes", () => {
	assert.equal(escapeHtml("<a href=\"x&y\">"), "&lt;a href=&quot;x&amp;y&quot;&gt;");
});

test("toNonEmptyTrimmedLines drops blank/whitespace lines", () => {
	assert.deepEqual(toNonEmptyTrimmedLines("\n  a  \nb\n  \n"), ["a", "b"]);
});

test("block builds a single-content block", () => {
	const b = block("mermaid", "diag", "flowchart LR");
	assert.equal(b.type, "mermaid");
	assert.equal(b.title, "diag");
	assert.deepEqual(b.contents, ["flowchart LR"]);
});

test("makeState returns a state object with the preset sections", () => {
	const s = makeState("porting");
	const shape = s.sections.map((section) => [section.title, section.enabled]);
	assert.deepEqual(shape, [
		["修改內容", false],
		["實作流程", false],
		["驗證結果", false],
	]);
});

test("blank preset starts with no sections", () => {
	const s = makeState("blank");
	assert.deepEqual(s.sections, []);
});

test("makeState keeps the test environment as 7 known items", () => {
	const env = makeState("porting").environment;
	assert.equal(env.length, 7);
	assert.ok(env.every((item) => item.custom === false));
	assert.ok(env.every((item) => item.enabled === false));
	assert.ok(env.every((item) => item.id && item.label));
});

test("normalizeState migrates a legacy environment object to items", () => {
	const legacy = makeState("porting");
	legacy.environment = { systemModel: "DVT2", bios: "", osKernel: "Ubuntu" };
	const env = normalizeState(legacy).environment;
	const sys = env.find((item) => item.label === "System Model");
	assert.equal(sys.value, "DVT2");
	assert.equal(sys.enabled, true);
	const bios = env.find((item) => item.label === "BIOS");
	assert.equal(bios.enabled, false);
	const os = env.find((item) => item.label === "OS / Kernel");
	assert.equal(os.value, "Ubuntu");
});

test("normalizeState migrates a legacy implementation block to per-item lang", () => {
	const legacy = {
		sections: [
			{
				title: "t",
				enabled: true,
				blocks: [{ type: "implementation", level: 1, codeLang: "py", content: "print(1)" }],
			},
		],
	};
	const migrated = normalizeState(legacy).sections[0].blocks[0];
	assert.deepEqual(migrated.contents, [{ content: "print(1)", lang: "py" }]);
	assert.equal(migrated.content, undefined);
	assert.equal(migrated.codeLang, undefined);
});

test("normalizeState drops legacy contentLangs arrays", () => {
	const legacy = {
		sections: [
			{
				title: "t",
				enabled: true,
				blocks: [
					{ type: "implementation", level: 1, contents: ["a", "b"], contentLangs: ["c", "sql"] },
				],
			},
		],
	};
	const migrated = normalizeState(legacy).sections[0].blocks[0];
	assert.deepEqual(migrated.contents, [
		{ content: "a", lang: "shell" },
		{ content: "b", lang: "shell" },
	]);
	assert.equal(migrated.contentLangs, undefined);
});

test("normalizeState floors level and clamps it to the previous plus one", () => {
	const legacy = {
		sections: [
			{
				title: "t",
				enabled: true,
				blocks: [
					{ type: "text", title: "a", contents: ["1"], level: 2 },
					{ type: "text", title: "b", contents: ["2"], level: 0 },
					{ type: "text", title: "c", contents: ["3"], level: 9 },
				],
			},
		],
	};
	const levels = normalizeState(legacy).sections[0].blocks.map((b) => b.level);
	// first block is forced to 1, the zero is floored up, the 9 is clamped
	// to previousLevel + 1.
	assert.deepEqual(levels, [1, 1, 2]);
});

test("safe replaces reserved characters with underscore", () => {
	assert.equal(safe('my:file/name?.txt'), "my_file_name_.txt");
});

import { createImplementationBlock, createEnvItem, normalizeEnvironment, environmentFields } from "../src/core/state.js";


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
