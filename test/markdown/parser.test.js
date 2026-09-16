import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

test("md: keeps balanced parens inside a link url", () => {
	const s = markdownToState("# t\n## 段\n[F](http://a_(b).md)");
	assert.deepEqual(s.title, "t");
	const contents = s.sections[0].blocks.flatMap((item) => item.contents);
	assert.deepEqual(contents, ['"F":http://a_(b).md']);
});

test("md: converts links inside headings", () => {
	const s = markdownToState("# [首頁](http://a)\n## [Flash](http://a.md)\n### [細節](http://a_(b).md)");
	assert.equal(s.title, '"首頁":http://a');
	assert.equal(s.sections[0].title, '"Flash":http://a.md');
	assert.equal(s.sections[0].blocks[0].title, '"細節":http://a_(b).md');
});

test("md: converts a relative-path link that does not start with http", () => {
	const s = markdownToState(
		"# p\n## 段\n- [相對路徑檔案](./docs/example.md)\n- [上層檔](../docs/example.md)"
	);
	const contents = s.sections[0].blocks.flatMap((item) => item.contents);
	assert.deepEqual(contents, ['"相對路徑檔案":./docs/example.md', '"上層檔":../docs/example.md']);
});

test("md: keeps each section's content when a later h2 starts", () => {
	const s = markdownToState("# p\n## 一\n- a\n- b\n## 二\n- c");
	const byTitle = new Map(s.sections.map((sec) => [sec.title, sec]));
	assert.deepEqual(byTitle.get("一").blocks.flatMap((b) => b.contents), ["a", "b"]);
	assert.deepEqual(byTitle.get("二").blocks.flatMap((b) => b.contents), ["c"]);
});
