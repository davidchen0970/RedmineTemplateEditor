export const LEGACY_STORAGE_KEY = "redmine-template-editor:v4-output-first";

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

export const escapeHtml = (stringValue) =>
	String(stringValue ?? "").replace(
		/[&<>"]/g,
		(character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
	);

export const toNonEmptyTrimmedLines = (stringValue) =>
	String(stringValue || "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

export function block(type, title, content = "") {
	return {
		id: createId(),
		type,
		title,
		content,
		contents: content ? [content] : [""],
		level: 1,
	};
}

export function createImplementationBlock(
	title = "api.c",
	workPath = "(docker)$ pwd",
	lang = "cpp",
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
		codeLang: lang,
		description,
		content,
		contents: content ? [content] : [""],
		level: 1,
	};
}

export function createSection(title, enabled, blocks = [], description = "") {
	return { id: createId(), title, enabled, description, blocks };
}

export const presets = {
	hardware: {
		label: "Hardware Check",
		desc: "Schematic / 線路檢查",
		title: "檢查 SOL 在 schematic 的電路",
		status: "PASS",
		change: "X",
		sections: [
			createSection("Block Diagram", false),
			createSection("Schematic", false),
			createSection("實作流程", false),
			createSection("結果驗證", false),
			createSection("參考資料", false),
		],
	},
	porting: {
		label: "Porting",
		desc: "功能移植 / 設定修改",
		title: "Porting SOL function",
		status: "PASS",
		change: "",
		sections: [
			createSection("Block Diagram", false),
			createSection("Schematic", false),
			createSection("實作流程", false),
			createSection("結果驗證", false),
			createSection("參考資料", false),
		],
	},
	debug: {
		label: "Debug",
		desc: "問題排查 / FAILED note",
		title: "在 obmc-console 當中加上 debug code 計算 client 個數",
		status: "FAILED",
		change: "",
		sections: [
			createSection("Block Diagram", false),
			createSection("Schematic", false),
			createSection("實作流程", false),
			createSection("結果驗證", false),
			createSection("參考資料", false),
		],
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
		environment: {
			systemModel: "",
			bios: "",
			bmcVersion: "",
			cpldVersion: "",
			cpuInformation: "",
			osKernel: "N/A",
			others: "N/A",
		},
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
	return LEGACY_STORAGE_KEY + ":page:" + encodeURIComponent(path);
}

export const DOCUMENT_INDEX_KEY = () => pageStoragePrefix() + ":documents";
export const ACTIVE_DOCUMENT_KEY = () => pageStoragePrefix() + ":activeDocument";
export const DEFAULT_DOCUMENT_ID = "default";

export function makeDocumentId() {
	return Date.now().toString(36) + "-" + createId();
}

export function safeDocumentName(name) {
	return String(name || "未命名").trim().replace(/\s+/g, " ").slice(0, 80) || "未命名";
}

export function documentStateKey(documentId = DEFAULT_DOCUMENT_ID) {
	return pageStoragePrefix() + ":state:" + documentId;
}

export function readDocumentIndex() {
	try {
		const documents = JSON.parse(localStorage.getItem(DOCUMENT_INDEX_KEY())) || [];
		return Array.isArray(documents) ? documents : [];
	} catch {
		return [];
	}
}

export function writeDocumentIndex(documents) {
	localStorage.setItem(DOCUMENT_INDEX_KEY(), JSON.stringify(documents, null, 2));
}

export function ensureDocumentIndex() {
	let documents = readDocumentIndex();
	if (!documents.length) {
		documents = [{ id: DEFAULT_DOCUMENT_ID, name: "預設文件", updatedAt: new Date().toISOString() }];
		writeDocumentIndex(documents);
	}
	return documents;
}

export function getActiveDocumentId() {
	const documents = ensureDocumentIndex();
	const saved = localStorage.getItem(ACTIVE_DOCUMENT_KEY());
	return documents.some((document) => document.id === saved) ? saved : documents[0].id;
}

export function setActiveDocumentId(documentId) {
	localStorage.setItem(ACTIVE_DOCUMENT_KEY(), documentId);
}

export function getActiveDocument() {
	const documents = ensureDocumentIndex();
	return documents.find((document) => document.id === getActiveDocumentId()) || documents[0];
}

export function renameDocument(documentId, name) {
	const documents = ensureDocumentIndex();
	const target = documents.find((document) => document.id === documentId);
	if (!target) return null;
	target.name = safeDocumentName(name);
	target.updatedAt = new Date().toISOString();
	writeDocumentIndex(documents);
	return target;
}

export function createDocument(name, initialState = makeState()) {
	const documents = ensureDocumentIndex();
	const documentId = makeDocumentId();
	const documentRecord = { id: documentId, name: safeDocumentName(name), updatedAt: new Date().toISOString() };
	documents.unshift(documentRecord);
	writeDocumentIndex(documents);
	setActiveDocumentId(documentId);
	saveState(initialState, documentId);
	return documentRecord;
}

export function deleteDocument(documentId) {
	let documents = ensureDocumentIndex();
	if (documents.length <= 1) return false;
	localStorage.removeItem(documentStateKey(documentId));
	documents = documents.filter((document) => document.id !== documentId);
	writeDocumentIndex(documents);
	if (getActiveDocumentId() === documentId) setActiveDocumentId(documents[0].id);
	return true;
}

export function loadState(documentId = getActiveDocumentId()) {
	try {
		const state = JSON.parse(localStorage.getItem(documentStateKey(documentId)));
		if (state) return normalizeState(state);
		if (documentId === DEFAULT_DOCUMENT_ID) {
			const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
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

export function saveState(state, documentId = getActiveDocumentId()) {
	state.updatedAt = new Date().toISOString();
	localStorage.setItem(documentStateKey(documentId), JSON.stringify(state, null, 2));
	const documents = ensureDocumentIndex();
	const target = documents.find((document) => document.id === documentId);
	if (target) {
		target.updatedAt = state.updatedAt;
		writeDocumentIndex(documents);
	}
}

export function safe(stringValue) {
	return String(stringValue || "redmine-note")
		.replace(/[\\/:*?"<>|\s]+/g, "_")
		.slice(0, 80);
}
