import { createSection } from "../core/state.js";

function newId() {
	return "md" + Math.random().toString(36).slice(2, 8);
}

function textBlock(title, items = []) {
	return { id: newId(), type: "text", title, level: 1, contents: items };
}

function codeBlock(lang, items) {
	return {
		id: newId(),
		type: "implementation",
		title: "",
		level: 1,
		contents: items,
		showWorkPath: false,
		workPath: "",
		workPathTitle: "",
		description: "",
		codeLang: lang,
	};
}

function imageBlock(url) {
	return { id: newId(), type: "image", title: "", level: 1, contents: [url] };
}

const IMAGE_LINE = /^!\[[^\]]*\]\(([^)]+)\)\s*$/;

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

export function markdownToState(content) {
	const text = String(content ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n");
	const state = blankState();
	let section = null;
	let block = null;
	let fence = null;

	for (const raw of text.split("\n")) {
		const line = raw.trim();

		if (fence !== null) {
			if (line.startsWith("```")) {
				if (section) section.blocks.push(codeBlock(fence.lang, fence.contents));
				fence = null;
			} else {
				fence.contents.push({ content: raw, lang: fence.lang });
			}
			continue;
		}

		if (line.startsWith("```")) {
			block = null;
			const lang = line.slice(3).trim() || "shell";
			fence = { lang, contents: [] };
			continue;
		}

		const h1 = /^# (.+)$/.exec(line);
		if (h1) { state.title = h1[1]; block = null; continue; }

		const h2 = /^## (.+)$/.exec(line);
		if (h2) {
			block = null;
			section = createSection(h2[1], true, [], "");
			state.sections.push(section);
			continue;
		}

		if (!section) {
			section = createSection("段落", true, [], "");
			state.sections.push(section);
		}

		if (block === null) block = { cur: textBlock("", []) };
		if (typeof block === "object" && !Array.isArray(block.cur.contents)) block = { cur: textBlock("", []) };

		const h3 = /^### (.+)$/.exec(line);
		if (h3) {
			if (block.cur.contents.length || block.cur.title) section.blocks.push(block.cur);
			block = { cur: textBlock(h3[1], []) };
			continue;
		}

		const item = /^[-*] (.+)$/.exec(line);
		if (item) {
			const img = IMAGE_LINE.exec(item[1]);
			if (img) {
				if (block.cur.contents.length || block.cur.title) section.blocks.push(block.cur);
				section.blocks.push(imageBlock(img[1]));
				block = null;
				continue;
			}
			if (!block.cur.contents.length && !block.cur.title) block.cur.title = "內文";
			block.cur.contents.push(item[1]);
			continue;
		}

		if (line) {
			const img = IMAGE_LINE.exec(line);
			if (img) {
				if (block.cur.contents.length || block.cur.title) section.blocks.push(block.cur);
				section.blocks.push(imageBlock(img[1]));
				block = null;
				continue;
			}
			if (!block.cur.contents.length && !block.cur.title) block.cur.title = "內文";
			block.cur.contents.push(line);
		}
	}

	if (fence !== null && section) {
		section.blocks.push(codeBlock(fence.lang, fence.contents));
	} else if (block !== null && block.cur) {
		if (block.cur.title || block.cur.contents.some((it) => (it instanceof Object ? it.contentBool : String(it).trim()))) {
			if (section) section.blocks.push(block.cur);
		}
	}

	if (!state.title) state.title = "未命名";
	return state;
}
