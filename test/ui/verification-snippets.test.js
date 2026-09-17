import { test } from "node:test";
import assert from "node:assert/strict";

test("verification: addVerificationSnippet appends a 結果驗證 command block", async () => {
	const { makeState, createSection } = await import("../../src/core/state.js");
	const { addVerificationSnippet } = await import("../../src/ui/formatting/verification-snippets.js");

	const state = makeState("porting");
	state.sections = [createSection("修改內容", true, [])];
	addVerificationSnippet(state, "systemctl");

	const section = state.sections.find((item) => item.title === "結果驗證");
	assert.ok(section, "a 結果驗證 section is created");
	assert.equal(section.enabled, true);
	assert.equal(section.blocks.length, 1);
	assert.equal(section.blocks[0].title, "systemctl");
	assert.match(section.blocks[0].contents[0], /systemctl status obmc-console@ttyS0/);
});
