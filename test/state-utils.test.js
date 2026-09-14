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
