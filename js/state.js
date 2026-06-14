export const KEY = "redmine-template-editor:v4-output-first";

export const envKeys = [
	["systemModel", "System Model"],
	["bios", "BIOS"],
	["bmcVersion", "BMC 版本"],
	["cpldVersion", "CPLD 版本"],
	["cpuInformation", "CPU Information"],
	["osKernel", "OS / Kernel"],
	["others", "Others"],
];

export const uid = () => Math.random().toString(36).slice(2, 10);

export const esc = (s) =>
	String(s ?? "").replace(
		/[&<>"]/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
	);

export const lines = (s) =>
	String(s || "")
		.split("\n")
		.map((x) => x.trim())
		.filter(Boolean);

export function block(type, title, content = "") {
	return {
		id: uid(),
		type,
		title,
		content,
		contents: content ? [content] : [""],
		level: 1,
	};
}

export function impl(
	title = "api.c",
	workPath = "(docker)$ pwd",
	lang = "cpp",
	content = "",
	description = "",
	workPathTitle = "work path",
	showWorkPath = true,
) {
	return {
		id: uid(),
		type: "implementation",
		title,
		workPath,
		workPathTitle,
		showWorkPath,
		codeLang: lang,
		description,
		content,
		contents: content ? [content] : [""],
		level: 1,
	};
}

export function sec(title, enabled, blocks = [], description = "") {
	return { id: uid(), title, enabled, description, blocks };
}

export const presets = {
	hardware: {
		label: "Hardware Check",
		desc: "Schematic / 線路檢查",
		title: "檢查 SOL 在 schematic 的電路",
		status: "PASS",
		change: "X",
		sections: [
			sec("Block Diagram", false),
			sec("Schematic", false),
			sec("實作流程", false),
			sec("結果驗證", false),
			sec("參考資料", false),
		],
	},
	porting: {
		label: "Porting",
		desc: "功能移植 / 設定修改",
		title: "Porting SOL function",
		status: "PASS",
		change: "",
		sections: [
			sec("Block Diagram", false),
			sec("Schematic", false),
			sec("實作流程", false),
			sec("結果驗證", false),
			sec("參考資料", false),
		],
	},
	debug: {
		label: "Debug",
		desc: "問題排查 / FAILED note",
		title: "在 obmc-console 當中加上 debug code 計算 client 個數",
		status: "FAILED",
		change: "",
		sections: [
			sec("Block Diagram", false),
			sec("Schematic", false),
			sec("實作流程", false),
			sec("結果驗證", false),
			sec("參考資料", false),
		],
	},
};

export function makeState(type = "porting") {
	const p = JSON.parse(JSON.stringify(presets[type]));
	return {
		noteType: type,
		title: p.title,
		status: p.status,
		summary: "",
		changeContent: p.change,
		relatedRef: "",
		environment: {
			systemModel: "",
			bios: "",
			bmcVersion: "",
			cpldVersion: "",
			cpuInformation: "",
			osKernel: "N/A",
			others: "N/A",
		},
		sections: p.sections,
		ui: {
			collapsed: {
				sections: {},
				blocks: {},
			},
		},
		updatedAt: new Date().toISOString(),
	};
}

export function normalizeState(state) {
	if (!state) return state;
	state.environment ||= {};
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
		});
	});
	return state;
}


export function pageStoragePrefix() {
	const path = ([location.origin, location.pathname].join("").replace(/\/$/, "")) || "local-page";
	return KEY + ":page:" + encodeURIComponent(path);
}

export const DOCUMENT_INDEX_KEY = () => pageStoragePrefix() + ":documents";
export const ACTIVE_DOCUMENT_KEY = () => pageStoragePrefix() + ":activeDocument";
export const DEFAULT_DOCUMENT_ID = "default";

export function makeDocumentId() {
	return Date.now().toString(36) + "-" + uid();
}

export function safeDocumentName(name) {
	return String(name || "未命名").trim().replace(/\s+/g, " ").slice(0, 80) || "未命名";
}

export function documentStateKey(id = DEFAULT_DOCUMENT_ID) {
	return pageStoragePrefix() + ":state:" + id;
}

export function readDocumentIndex() {
	try {
		const docs = JSON.parse(localStorage.getItem(DOCUMENT_INDEX_KEY())) || [];
		return Array.isArray(docs) ? docs : [];
	} catch {
		return [];
	}
}

export function writeDocumentIndex(docs) {
	localStorage.setItem(DOCUMENT_INDEX_KEY(), JSON.stringify(docs, null, 2));
}

export function ensureDocumentIndex() {
	let docs = readDocumentIndex();
	if (!docs.length) {
		docs = [{ id: DEFAULT_DOCUMENT_ID, name: "預設文件", updatedAt: new Date().toISOString() }];
		writeDocumentIndex(docs);
	}
	return docs;
}

export function getActiveDocumentId() {
	const docs = ensureDocumentIndex();
	const saved = localStorage.getItem(ACTIVE_DOCUMENT_KEY());
	return docs.some((d) => d.id === saved) ? saved : docs[0].id;
}

export function setActiveDocumentId(id) {
	localStorage.setItem(ACTIVE_DOCUMENT_KEY(), id);
}

export function getActiveDocument() {
	const docs = ensureDocumentIndex();
	return docs.find((d) => d.id === getActiveDocumentId()) || docs[0];
}

export function renameDocument(id, name) {
	const docs = ensureDocumentIndex();
	const target = docs.find((d) => d.id === id);
	if (!target) return null;
	target.name = safeDocumentName(name);
	target.updatedAt = new Date().toISOString();
	writeDocumentIndex(docs);
	return target;
}

export function createDocument(name, initialState = makeState()) {
	const docs = ensureDocumentIndex();
	const id = makeDocumentId();
	const doc = { id, name: safeDocumentName(name), updatedAt: new Date().toISOString() };
	docs.unshift(doc);
	writeDocumentIndex(docs);
	setActiveDocumentId(id);
	saveState(initialState, id);
	return doc;
}

export function deleteDocument(id) {
	let docs = ensureDocumentIndex();
	if (docs.length <= 1) return false;
	localStorage.removeItem(documentStateKey(id));
	docs = docs.filter((d) => d.id !== id);
	writeDocumentIndex(docs);
	if (getActiveDocumentId() === id) setActiveDocumentId(docs[0].id);
	return true;
}

export function loadState(id = getActiveDocumentId()) {
	try {
		const state = JSON.parse(localStorage.getItem(documentStateKey(id)));
		if (state) return normalizeState(state);
		if (id === DEFAULT_DOCUMENT_ID) {
			const legacy = JSON.parse(localStorage.getItem(KEY));
			if (legacy) {
				const normalized = normalizeState(legacy);
				saveState(normalized, DEFAULT_DOCUMENT_ID);
				return normalized;
			}
		}
		return null;
	} catch {
		return null;
	}
}

export function saveState(state, id = getActiveDocumentId()) {
	state.updatedAt = new Date().toISOString();
	localStorage.setItem(documentStateKey(id), JSON.stringify(state, null, 2));
	const docs = ensureDocumentIndex();
	const target = docs.find((d) => d.id === id);
	if (target) {
		target.updatedAt = state.updatedAt;
		writeDocumentIndex(docs);
	}
}

export function safe(s) {
	return String(s || "redmine-note")
		.replace(/[\\/:*?"<>|\s]+/g, "_")
		.slice(0, 80);
}
