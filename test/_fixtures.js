import { createImplementationBlock, createSection, makeState } from "../src/core/state.js";

export function makeBlock(type, title, content = "") {
	return { id: "x", type, title, contents: content ? [content] : [""], level: 1 };
}

export function stateWithMermaid() {
	const s = makeState();
	s.title = "樣本";
	s.sections = [createSection("圖表", true, [makeBlock("mermaid", "diag", "flowchart LR\nA-->B")])];
	return s;
}

export function stateWithImplementation() {
	const s = makeState();
	s.title = "impl";
	s.sections = [
		createSection("實作", true, [
			createImplementationBlock("api.c", "(docker)$ pwd", "c", "int x;"),
		]),
	];
	return s;
}

export function stateWithEnvironment() {
	const s = makeState();
	s.title = "env";
	s.environment = [
		{ id: "a", label: "System Model", value: "DVT2", enabled: true, custom: false },
		{ id: "b", label: "BIOS", value: "", enabled: true, custom: false },
		{ id: "c", label: "OS / Kernel", value: "Ubuntu 22.04", enabled: false, custom: false },
	];
	return s;
}
