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
		updatedAt: new Date().toISOString(),
	};
}

export function loadState() {
	try {
		return JSON.parse(localStorage.getItem(KEY));
	} catch {
		return null;
	}
}

export function saveState(state) {
	state.updatedAt = new Date().toISOString();
	localStorage.setItem(KEY, JSON.stringify(state, null, 2));
}

export function safe(s) {
	return String(s || "redmine-note")
		.replace(/[\\/:*?"<>|\s]+/g, "_")
		.slice(0, 80);
}
