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

test("md: turns an image link into an image block", () => {
	const s = markdownToState("# t\n## 段\n![](http://a.png)\n- ![](http://b.png)");
	const images = s.sections[0].blocks.filter((item) => item.type === "image");
	assert.equal(images.length, 2);
	assert.deepEqual(images.map((item) => item.contents), [["http://a.png"], ["http://b.png"]]);
});

test("md: turns a link into the textile link form", () => {
	const s = markdownToState("# t\n## 段\n[文件](http://ex.com/doc)\n- [原始碼](http://ex.com/src)");
	const contents = s.sections[0].blocks.flatMap((item) => item.contents);
	assert.deepEqual(contents, ['"文件":http://ex.com/doc', '"原始碼":http://ex.com/src']);
});
