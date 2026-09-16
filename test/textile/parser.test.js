import { test } from "node:test";
import assert from "node:assert/strict";
import { textileToState } from "../../src/textile/parser.js";

test("textile: reads the h2 as the note title", () => {
	const s = textileToState("h2. 我的標題\n\n內容");
	assert.equal(s.title, "我的標題");
});

test("textile: turns each plain h3 into a section", () => {
	const s = textileToState("h2. t\nh3. 第一段\nh3. 第二段");
	assert.equal(s.sections.length, 2);
	assert.equal(s.sections[0].title, "第一段");
	assert.equal(s.sections[1].title, "第二段");
});

test("textile: reads PASS from the conclusion status line", () => {
	const s = textileToState("h2. t\nh3. 結論\n执行状态: %{color:green}PASS%\n* 一件事");
	assert.equal(s.status, "PASS");
	assert.match(s.summary, /一件事/);
});

test("textile: fills environment items from the 測試環境 block", () => {
	const s = textileToState("h2. t\nh3. 測試環境\n* System Model: DVT2\n");
	assert.equal(s.environment.length, 1);
	assert.equal(s.environment[0].label, "System Model");
	assert.equal(s.environment[0].value, "DVT2");
	assert.ok(s.environment[0].enabled);
});

test("textile: collects section content lines into one text block", () => {
	const s = textileToState("h2. t\nh3. 步驟\n第一行\n# 帶標記\n第二行\n");
	const section = s.sections[0];
	assert.equal(section.blocks.length, 1);
	assert.equal(section.blocks[0].type, "text");
	assert.deepEqual(section.blocks[0].contents, ["第一行", "# 帶標記", "第二行"]);
});
