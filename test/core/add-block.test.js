import { test } from "node:test";
import assert from "node:assert/strict";
import { block, createImplementationBlock } from "../../src/core/state.js";
import { DEFAULT_CODE_LANG } from "../../src/core/text.js";
import { ensureBlockContents } from "../../src/textile/generator.js";
import { applyDefaults, defaultTitle, titleDisabled } from "../../src/ui/editor/block-view.js";
import { getLocale, setLocale } from "../../src/i18n.js";

test("block() returns an add-block shape with level 1 and a contents array", () => {
	const b = block("text", "說明", "內文");
	assert.equal(b.type, "text");
	assert.equal(b.title, "說明");
	assert.equal(b.level, 1);
	assert.deepEqual(b.contents, ["內文"]);
	// A fresh add-block always carries an id so the view can key/select it.
	assert.ok(typeof b.id === "string" && b.id.length > 0);
});

test("block() with no content yields a single empty string slot", () => {
	const b = block("text", "說明");
	assert.equal(b.level, 1);
	assert.deepEqual(b.contents, [""]);
});

test("createImplementationBlock() applies the add-block defaults", () => {
	const b = createImplementationBlock();
	assert.equal(b.type, "implementation");
	assert.equal(b.title, "api.c");
	assert.equal(b.workPath, "(docker)$ pwd");
	assert.equal(b.workPathTitle, "");
	assert.equal(b.showWorkPath, true);
	assert.equal(b.description, "");
	assert.equal(b.level, 1);
	// A single {content, lang} slot, defaulting lang to the shell code language.
	assert.equal(b.contents.length, 1);
	assert.deepEqual(b.contents[0], { content: "", lang: DEFAULT_CODE_LANG });
	assert.equal(DEFAULT_CODE_LANG, "shell");
});

test("createImplementationBlock() fills a content slot with the provided lang and content", () => {
	const b = createImplementationBlock("a.c", "/src", "cpp", "int x;");
	assert.deepEqual(b.contents, [{ content: "int x;", lang: "cpp" }]);
	assert.equal(b.workPath, "/src");
	assert.equal(b.description, "");
});

test("ensureBlockContents() normalizes implementation slots to {content, lang} objects", () => {
	const contents = ensureBlockContents({ type: "implementation", contents: ["echo hi"] });
	assert.deepEqual(contents, [{ content: "echo hi", lang: DEFAULT_CODE_LANG }]);
});

test("ensureBlockContents() keeps object slots and fills a missing lang with the shell default", () => {
	const contents = ensureBlockContents({
		type: "implementation",
		contents: [{ content: "x" }, { content: "y", lang: "python" }],
	});
	assert.deepEqual(contents, [
		{ content: "x", lang: DEFAULT_CODE_LANG },
		{ content: "y", lang: "python" },
	]);
});

test("ensureBlockContents() normalizes non-implementation slots to plain strings", () => {
	const contents = ensureBlockContents({ type: "text", contents: [{ content: "hello" }, "world"] });
	assert.deepEqual(contents, ["hello", "world"]);
});

test("ensureBlockContents() guarantees at least one empty slot", () => {
	assert.deepEqual(ensureBlockContents({ type: "text", contents: [] }), [""]);
});

test("applyDefaults() backfills an implementation block, workPathTitle from the active locale", () => {
	const original = getLocale();
	try {
		setLocale("zh");
		const zhBlock = { type: "implementation" };
		applyDefaults(zhBlock);
		assert.equal(zhBlock.title, "api.c");
		assert.equal(zhBlock.workPath, "(docker)$ pwd");
		assert.equal(zhBlock.workPathTitle, "工作路徑");

		// Existing values are preserved (||= is fill-only).
		const filled = { type: "implementation", title: "keep.c", workPath: "/x", workPathTitle: "自訂" };
		applyDefaults(filled);
		assert.equal(filled.title, "keep.c");
		assert.equal(filled.workPath, "/x");
		assert.equal(filled.workPathTitle, "自訂");

		setLocale("en");
		const enBlock = { type: "implementation" };
		applyDefaults(enBlock);
		assert.equal(enBlock.workPathTitle, "Working Path");
	} finally {
		setLocale(original);
	}
});

test("applyDefaults() leaves non-implementation blocks untouched", () => {
	const b = { type: "text", title: "" };
	applyDefaults(b);
	assert.equal(b.title, "");
	assert.equal(b.workPath, undefined);
	assert.equal(b.workPathTitle, undefined);
});

test("defaultTitle() returns the per-type add-block default title", () => {
	const original = getLocale();
	try {
		setLocale("en");
		assert.equal(defaultTitle("implementation"), "api.c");
		assert.equal(defaultTitle("text"), "");
		assert.equal(defaultTitle("plainText"), "");
		assert.equal(defaultTitle("diff"), "");
		assert.equal(defaultTitle("image"), "");
		assert.equal(defaultTitle("command"), "Command");
		assert.equal(defaultTitle("log"), "Log");
		assert.equal(defaultTitle("mermaid"), "Flowchart");
		assert.equal(defaultTitle("collapse"), "Collapse");
		// Unknown types fall back to an empty string.
		assert.equal(defaultTitle("anything"), "");
	} finally {
		setLocale(original);
	}
});

test("titleDisabled() only locks the plainText title field", () => {
	assert.equal(titleDisabled("plainText"), true);
	for (const type of ["implementation", "text", "command", "diff", "log", "mermaid", "image", "collapse"]) {
		assert.equal(titleDisabled(type), false, type);
	}
	assert.equal(titleDisabled(""), false);
});
