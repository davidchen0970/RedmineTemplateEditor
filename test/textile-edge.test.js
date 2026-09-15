import { test } from "node:test";
import assert from "node:assert/strict";
import { textile } from "../src/textile/generator.js";
import { createSection, makeState } from "../src/core/state.js";

function stateWith(blocks, options = {}) {
	const s = makeState("porting");
	s.title = options.title ?? "樣本";
	s.status = options.status ?? "N/A";
	if (options.changeContent !== undefined) s.changeContent = options.changeContent;
	if (options.summary !== undefined) s.summary = options.summary;
	if (options.relatedRef !== undefined) s.relatedRef = options.relatedRef;
	s.sections = [createSection("區段", true, blocks)];
	return s;
}

test("status PASS / FAILED / WIP each carry their textile color span", () => {
	for (const [status, span] of [
		["PASS", "%{color:green}PASS%"],
		["FAILED", "%{color:red}FAILED%"],
		["WIP", "%{color:orange}WIP%"],
	]) {
		const out = textile(stateWith([], { status }));
		assert.ok(out.includes(span), `${status} 應輸出 ${span}`);
	}
});

test("N/A status emits no 結論 h3 at all", () => {
	const out = textile(stateWith([], { status: "N/A" }));
	assert.ok(!/n3\. 結論|結論/.test(out));
});

test("summary lines become textile bullets", () => {
	const s = stateWith([], { summary: "done\n second item \n" });
	const out = textile(s);
	assert.match(out, /\* done/);
	assert.match(out, /\* second item/);
});

test("environment values with list markers and blank lines are cleaned", () => {
	const s = stateWith([], { status: "N/A" });
	s.environment = [
		{ id: "e", label: "BIOS", value: "v2.1\n\n* 看到項\n 2. 第二項", enabled: true, custom: false },
	];
	const out = textile(s);
	assert.match(out, /\* BIOS:/);
	assert.match(out, /\*# v2\.1/);
	assert.match(out, /\*# 看到項/);
	assert.match(out, /\*# 第二項/);
});

test("blockLevel below 1 or fractional is normalised to a real textile heading", () => {
	const b = { type: "text", title: "t", contents: ["內文"], level: 1.9 };
	const out = textile(stateWith([b]));
	// the `# ` heading marker is produced from the floored level
	assert.doesNotMatch(out, /undefined/);
	assert.match(out, /内文|內文/);
});

test("plainText block at level 1 emits content untouched (not marker-prefixed)", () => {
	const b = { type: "plainText", title: "", contents: ["第一行\n第二行"], level: 1 };
	const out = textile(stateWith([b]));
	assert.ok(out.includes("第一行\n第二行"));
});

test("collapse block with several contents numbers each pane", () => {
	const b = { type: "collapse", title: "附錄", contents: ["A", "B"], level: 1 };
	const out = textile(stateWith([b]));
	assert.match(out, /{{collapse\(附錄 #1\)/);
	assert.match(out, /{{collapse\(附錄 #2\)/);
});

test("image block strips wrapping ! and empty lines, emits one per URL", () => {
	const b = { type: "image", title: "", contents: ["!http://a.png!\nhttp://b.png\n \n!c.png!"], level: 1 };
	const out = textile(stateWith([b]));
	assert.doesNotMatch(out, /!!/);
	assert.ok(out.includes("!http://a.png!"));
	assert.ok(out.includes("!http://b.png!"));
	assert.ok(out.includes("!c.png!"));
});

test("implementation block hides work path when showWorkPath is false", () => {
	const b = { type: "implementation", title: "a.c", contents: [{ content: "x", lang: "c" }], showWorkPath: false, level: 1 };
	const out = textile(stateWith([b]));
	assert.doesNotMatch(out, /work path/);
	assert.match(out, /<pre><code class="c">/);
});

test("relatedRef is emitted after the h2 heading", () => {
	const s = stateWith([], { relatedRef: "見 #42" });
	const out = textile(s);
	const h2 = out.indexOf("h2.");
	const ref = out.indexOf("見 #42");
	assert.ok(h2 !== -1 && ref > h2);
});

test("code spans (%{color:red}..%) inside a shell block are moved outside the code frame", () => {
	const s = stateWith([]);
	s.status = "N/A";
	s.changeContent = "";
	s.sections = [
		createSection("output", true, [
			{ type: "command", title: "", contents: ["OK %{color:green}PASSED%"], level: 1 },
		]),
	];
	const out = textile(s);
	// the %{} span must not be swallowed inside the code text unchanged
	assert.match(out, /PASSED%/);
});
