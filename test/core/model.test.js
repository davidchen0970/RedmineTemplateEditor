import { test } from "node:test";
import assert from "node:assert/strict";

test("model: makeState assembles a porting document with an environment grid", async () => {
	const { makeState, environmentFields } = await import("../../src/core/state.js");
	const state = makeState("porting");
	assert.equal(state.noteType, "porting");
	assert.equal(state.title, "Porting SOL function");
	assert.equal(state.status, "PASS");
	assert.equal(state.environmentEnabled, true);
	// Every standard field becomes a custom:false env item.
	assert.equal(state.environment.length, environmentFields.length);
	assert.ok(state.environment.every((item) => item.custom === false));
	assert.equal(state.environment[0].label, "System Model");
	assert.equal(state.environment[0].enabled, false);
	// Sections come from the presets.
	assert.ok(Array.isArray(state.sections));
	// updatedAt is a valid ISO timestamp.
	assert.equal(Number.isNaN(new Date(state.updatedAt).getTime()), false);
});

test("model: every preset produces a valid state regardless of type", async () => {
	const { makeState, presets } = await import("../../src/core/state.js");
	for (const type of Object.keys(presets)) {
		const state = makeState(type);
		assert.equal(state.noteType, type);
		assert.ok(Array.isArray(state.environment));
		assert.ok(Array.isArray(state.sections));
	}
});

test("model: normalizeEnvironment maps an object bundle or passes through an array", async () => {
	const { normalizeEnvironment } = await import("../../src/core/state.js");
	const fromObject = normalizeEnvironment({ systemModel: "DVT2" });
	const systemModel = fromObject.find((item) => item.label === "System Model");
	assert.equal(systemModel.value, "DVT2");
	assert.equal(systemModel.custom, false); // flags are normalized to primitives
	const fromArray = normalizeEnvironment([{ label: "自訂", value: "7", enabled: true, custom: true }]);
	assert.equal(fromArray[0].label, "自訂");
	assert.equal(fromArray[0].enabled, true);
	assert.equal(fromArray[0].custom, true);
});

test("model: normalizeState clamps block level to the previous block + 1", async () => {
	const { makeState, createSection, normalizeState } = await import("../../src/core/state.js");
	const state = makeState("blank");
	const section = createSection("實作", true, [
		{ id: "a", type: "implementation", title: "a.c", contents: [""], level: 1 },
	]);
	state.sections = [section];
	state.sections[0].blocks.push({ id: "b", type: "implementation", title: "b.c", contents: [""], level: 99 });
	normalizeState(state);
	assert.equal(state.sections[0].blocks[1].level, 2); // clamped to previous.level + 1
});

test("model: normalizeState migrates a legacy content/codeLang block into contents[]", async () => {
	const { makeState, createSection, normalizeState } = await import("../../src/core/state.js");
	const state = makeState("blank");
	state.sections = [createSection("驗證結果", true)];
	state.sections[0].blocks = [{ id: "x", type: "implementation", title: "x.c", content: "int x;", codeLang: "c", level: 1 }];
	normalizeState(state);
	const b = state.sections[0].blocks[0];
	assert.equal(b.contents[0].content, "int x;");
	assert.equal(b.contents[0].lang, "c");
	assert.equal(b.content, undefined);
	assert.equal(b.codeLang, undefined);
});
