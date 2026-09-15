import { DEFAULT_CODE_LANG } from "./text.js";

export const environmentFields = [
	["systemModel", "System Model"],
	["bios", "BIOS"],
	["bmcVersion", "BMC 版本"],
	["cpldVersion", "CPLD 版本"],
	["cpuInformation", "CPU Information"],
	["osKernel", "OS / Kernel"],
	["others", "Others"],
];

export const createId = () => Math.random().toString(36).slice(2, 10);

export function block(type, title, content = "") {
	return {
		id: createId(),
		type,
		title,
		contents: content ? [content] : [""],
		level: 1,
	};
}

export function createImplementationBlock(
	title = "api.c",
	workPath = "(docker)$ pwd",
	lang = DEFAULT_CODE_LANG,
	content = "",
	description = "",
	workPathTitle = "work path",
	showWorkPath = true,
) {
	return {
		id: createId(),
		type: "implementation",
		title,
		workPath,
		workPathTitle,
		showWorkPath,
		description,
		contents: content ? [{ content, lang }] : [{ content: "", lang }],
		level: 1,
	};
}

export function createSection(title, enabled, blocks = [], description = "") {
	return { id: createId(), title, enabled, description, blocks };
}

export function createEnvItem(label, value = "", enabled = false, custom = false) {
	return { id: createId(), label, value, enabled, custom };
}

export function normalizeEnvironment(environment) {
	if (Array.isArray(environment)) {
		return environment.map((item) => ({
			id: String(item?.id || createId()),
			label: String(item?.label ?? ""),
			value: String(item?.value ?? ""),
			enabled: Boolean(item?.enabled),
			custom: Boolean(item?.custom),
		}));
	}
	return environmentFields.map(([fieldKey, label]) => ({
		id: createId(),
		label,
		value: String(environment?.[fieldKey] ?? ""),
		enabled: Boolean(environment && String(environment[fieldKey] ?? "").trim()),
		custom: false,
	}));
}

export const presets = {
	hardware: {
		label: "Hardware Check",
		desc: "Schematic / 線路檢查",
		title: "Hardware Check",
		status: "PASS",
		change: "X",
		sections: [
			createSection("檢查項目", false),
			createSection("檢查結果", false),
			createSection("線路 / 示意圖", false),
		],
	},
	porting: {
		label: "Porting",
		desc: "功能移植 / 設定修改",
		title: "Porting SOL function",
		status: "PASS",
		change: "",
		sections: [
			createSection("修改內容", false),
			createSection("實作流程", false),
			createSection("驗證結果", false),
		],
	},
	debug: {
		label: "Debug",
		desc: "問題排查 / FAILED note",
		title: "問題排查",
		status: "FAILED",
		change: "",
		sections: [
			createSection("問題現象", false),
			createSection("原因分析", false),
			createSection("修正內容", false),
		],
	},
	blank: {
		label: "空白",
		desc: "全自訂",
		title: "",
		status: "N/A",
		change: "",
		sections: [],
	},
};

export function makeState(type = "porting") {
	const preset = JSON.parse(JSON.stringify(presets[type]));
	return {
		noteType: type,
		title: preset.title,
		status: preset.status,
		summary: "",
		changeContent: preset.change,
		relatedRef: "",
		environment: environmentFields.map(([, label]) => createEnvItem(label)),
		sections: preset.sections,
		ui: {
			collapsed: {
				sections: {},
				blocks: {},
			},
		},
		updatedAt: new Date().toISOString(),
	};
}

function migrateImplementationBlock(block) {
	const fallback = String(block.codeLang || "").trim() || DEFAULT_CODE_LANG;
	if (Array.isArray(block.contents)) {
		block.contents = block.contents.map((contentItem) =>
			typeof contentItem === "object"
				? { content: String(contentItem.content ?? ""), lang: String(contentItem.lang || "").trim() || fallback }
				: { content: String(contentItem ?? ""), lang: fallback },
		);
	} else {
		const raw = String(block.content ?? "");
		block.contents = raw.trim()
			? [{ content: raw, lang: fallback }]
			: [{ content: "", lang: fallback }];
	}
	if (!block.contents.length) block.contents.push({ content: "", lang: fallback });
	delete block.content;
	delete block.contentLangs;
	delete block.codeLang;
}

export function normalizeState(state) {
	if (!state) return state;
	state.environment = normalizeEnvironment(state.environment);
	state.sections = Array.isArray(state.sections) ? state.sections : [];
	state.ui ||= {};
	state.ui.collapsed ||= {};
	state.ui.collapsed.sections ||= {};
	state.ui.collapsed.blocks ||= {};
	state.sections.forEach((section) => {
		section.blocks = Array.isArray(section.blocks) ? section.blocks : [];
		section.blocks.forEach((block, index) => {
			const previousLevel = index > 0 ? Number(section.blocks[index - 1]?.level || 1) : 0;
			const maxLevel = index > 0 ? previousLevel + 1 : 1;
			const rawLevel = Number(block.level || 1);
			block.level = Math.max(1, Math.min(Number.isFinite(rawLevel) ? Math.floor(rawLevel) : 1, maxLevel));
			if (block.type === "implementation") migrateImplementationBlock(block);
		});
	});
	return state;
}
