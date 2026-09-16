import { createSection, createEnvItem } from "../core/state.js";

function newId() {
	return "tx" + Math.random().toString(36).slice(2, 8);
}

function textBlock(items) {
	return { id: newId(), type: "text", title: "內文", level: 1, contents: items };
}

function blankState() {
	return {
		title: "",
		status: "N/A",
		summary: "",
		changeContent: "",
		relatedRef: "",
		environmentEnabled: true,
		environment: [],
		sections: [],
		ui: { collapsed: { sections: {}, blocks: {} } },
		updatedAt: new Date().toISOString(),
	};
}

export function textileToState(text) {
	const state = blankState();
	let mode = "head";
	let section = null;
	let block = null;

	for (const raw of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
		const line = raw.trim();

		const h2 = /^h2\.\s+(.+)$/.exec(line);
		if (h2) { state.title = h2[1]; continue; }

		const h3 = /^h3\.\s+(.+)$/.exec(line);
		if (h3) {
			const heading = h3[1].trim();
			block = null;
			if (heading === "結論") { mode = "conclusion"; continue; }
			if (heading === "修改目標") { mode = "change"; continue; }
			if (heading === "測試環境") { mode = "env"; continue; }
			mode = "section";
			section = createSection(heading, true, [], "");
			state.sections.push(section);
			continue;
		}
		if (!line) continue;

		if (mode === "env") {
			const match = /^\*\s+(.+?):\s?(.*)$/.exec(line);
			if (match) {
				state.environment.push(createEnvItem(match[1].trim(), match[2].trim(), true, false));
			}
			continue;
		}
		if (mode === "conclusion") {
			const statusMatch = line.match(/(PASS|FAILED|WIP|N\/A)/);
			if (statusMatch) { state.status = statusMatch[1]; continue; }
			const star = /^\*\s+(.+)$/.exec(line);
			if (star) { if (state.summary) state.summary += "\n"; state.summary += star[1]; }
			continue;
		}
		if (mode === "change") {
			const label = /^修改內容:\s?(.*)$/.exec(line);
			if (label) { state.changeContent = label[1]; continue; }
			const item = /^#\s+(.+)$/.exec(line);
			if (item) { if (state.changeContent) state.changeContent += "\n"; state.changeContent += item[1]; }
			continue;
		}
		if (mode === "section" && section) {
			if (block === null) block = textBlock([]);
			block.contents.push(line);
		}
	}
	if (block !== null && section) section.blocks.push(block);
	if (!state.title) state.title = "未命名";
	return state;
}
