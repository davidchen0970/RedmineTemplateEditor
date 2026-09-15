import { createSection, makeState } from "../src/core/state.js";

export function makeBlock(type, title, content = "") {
	return { id: "x", type, title, contents: content ? [content] : [""], level: 1 };
}

export function stateWithMermaid() {
	const s = makeState();
	s.title = "樣本";
	s.sections = [createSection("圖表", true, [makeBlock("mermaid", "diag", "flowchart LR\nA-->B")])];
	return s;
}
