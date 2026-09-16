import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToState } from "../../src/markdown/parser.js";

test("md: reads the h1 as the note title", () => {
	const s = markdownToState("# 我的標題\n\n內容");
	assert.equal(s.title, "我的標題");
});

test("md: makes each h2 its own section", () => {
	const s = markdownToState("# t\n## 第一段\n## 第二段");
	assert.equal(s.sections.length, 2);
	assert.equal(s.sections[0].title, "第一段");
	assert.equal(s.sections[1].title, "第二段");
	assert.ok(s.sections.every((item) => item.enabled));
});

test("md: groups list items one text block", () => {
	const s = markdownToState("# t\n## 段\n- a\n- b\n");
	const section = s.sections[0];
	assert.equal(section.blocks.length, 1);
	assert.equal(section.blocks[0].type, "text");
	assert.deepEqual(section.blocks[0].contents, ["a", "b"]);
});

test("md: keeps a fenced code block as an implementation block", () => {
	const s = markdownToState("# t\n## 段\n\`\`\`shell\necho hi\n\`\`\`\n");
	const section = s.sections[0];
	const impl = section.blocks.find((b) => b.type === "implementation");
	assert.ok(impl);
	assert.deepEqual(impl.contents[0].content, "echo hi");
	assert.equal(impl.contents[0].lang, "shell");
});

test("md: falls back to an unnamed title", () => {
	const s = markdownToState("## 只有一段\n");
	assert.equal(s.title, "未命名");
});
