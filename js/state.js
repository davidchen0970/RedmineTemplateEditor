/* State, presets, persistence, and shared helpers. */
var KEY = "redmine-template-editor:v3";
var envKeys = [
	["systemModel", "System Model"],
	["bios", "BIOS"],
	["bmcVersion", "BMC 版本"],
	["cpldVersion", "CPLD 版本"],
	["cpuInformation", "CPU Information"],
	["osKernel", "OS / Kernel"],
	["others", "Others"],
];
function uid() {
	return Math.random().toString(36).slice(2, 10);
}
function block(type, title, content) {
	return { id: uid(), type, title, content };
}
function impl(
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
	};
}
function sec(title, enabled, blocks = [], description = "") {
	return { id: uid(), title, enabled, description, blocks };
}
var presets = {
	hardware: {
		label: "Hardware Check",
		desc: "Schematic / 線路檢查",
		title: "檢查 SOL 在 schematic 的電路",
		status: "PASS",
		summary: "",
		change: "X",
		sections: [
			sec("Block Diagram", false, []),
			sec("Schematic", false, []),
			sec("實作流程", false, []),
			sec("結果驗證", false, []),
			sec("參考資料", false, []),
		],
	},
	porting: {
		label: "Porting",
		desc: "功能移植 / 設定修改",
		title: "Porting SOL function",
		status: "PASS",
		summary: "",
		change: "",
		sections: [
			sec("Block Diagram", false, []),
			sec("Schematic", false, []),
			sec("實作流程", false, []),
			sec("結果驗證", false, []),
			sec("參考資料", false, []),
		],
	},
	debug: {
		label: "Debug",
		desc: "問題排查 / FAILED note",
		title: "在 obmc-console 當中加上 debug code 計算 client 個數",
		status: "FAILED",
		summary: "",
		change: "",
		sections: [
			sec("Block Diagram", false, []),
			sec("Schematic", false, []),
			sec("實作流程", false, []),
			sec("結果驗證", false, []),
			sec("參考資料", false, []),
		],
	},
};
function makeState(type = "porting") {
	const p = JSON.parse(JSON.stringify(presets[type]));
	return {
		noteType: type,
		title: p.title,
		status: p.status,
		summary: p.summary,
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
		updatedAt: new Date().toISOString(),
	};
}
var state = load() || makeState();
var view = "raw";
var exportStatus = { json: false, txt: false };
var lastSaveText = "";

var COLLAPSE_KEY = KEY + ":collapsed";
function loadCollapsedState() {
	try {
		return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {};
	} catch {
		return {};
	}
}
function saveCollapsedStateMap(map) {
	localStorage.setItem(COLLAPSE_KEY, JSON.stringify(map));
}
function isCollapsedTarget(targetId) {
	return loadCollapsedState()[targetId] === true;
}
function setCollapsedTarget(targetId, collapsed) {
	const map = loadCollapsedState();
	if (collapsed) map[targetId] = true;
	else delete map[targetId];
	saveCollapsedStateMap(map);
}
function applySavedCollapseState(root = document) {
	root.querySelectorAll("[data-collapse-target]").forEach((toggle) => {
		const targetId = toggle.dataset.collapseTarget;
		const target = document.getElementById(targetId);
		if (!target) return;
		const collapsed = isCollapsedTarget(targetId);
		toggle.setAttribute("aria-expanded", String(!collapsed));
		target.classList.toggle("collapsed", collapsed);
		target.style.height = "";
	});
}


function load() {
	try {
		return JSON.parse(localStorage.getItem(KEY));
	} catch {
		return null;
	}
}
function save() {
	state.updatedAt = new Date().toISOString();
	localStorage.setItem(KEY, JSON.stringify(state, null, 2));
	lastSaveText = "已自動儲存 " + new Date().toLocaleTimeString();
	renderSaveStatus();
}
function esc(s) {
	return String(s ?? "").replace(
		/[&<>"]/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
	);
}
function lines(s) {
	return String(s || "")
		.split("\n")
		.map((x) => x.trim())
		.filter(Boolean);
}

function label(t) {
	const labels = {
		implementation: "Implementation Unit",
		text: "Text / Textile",
		command: "Command Block",
		diff: "Diff Block",
		log: "Log Block",
		mermaid: "Mermaid Block",
		image: "Image",
		collapse: "Collapse",
	};

	return labels[t] || t;
}
function findSec(id) {
	return state.sections.find((s) => s.id === id);
}
function ensureSections() {
	if (!Array.isArray(state.sections)) state.sections = [];
}
function ensureBlockContents(b) {
	if (!Array.isArray(b.contents)) {
		const oldContent = String(b.content ?? "");
		b.contents = oldContent ? [oldContent] : [""];
	}
	if (!b.contents.length) b.contents.push("");
	syncBlockContent(b);
}
function getBlockContents(b) {
	ensureBlockContents(b);
	return b.contents.map((x) => String(x ?? ""));
}
function syncBlockContent(b) {
	if (!Array.isArray(b.contents)) return;
	b.content = b.contents.join("\n");
}
