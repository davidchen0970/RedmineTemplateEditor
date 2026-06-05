const KEY = "redmine-template-editor:v3";
const envKeys = [
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
const presets = {
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
let state = load() || makeState();
let view = "raw";
let exportStatus = { json: false, txt: false };
let lastSaveText = "";

const COLLAPSE_KEY = KEY + ":collapsed";
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

function renderSaveStatus() {
	const el = document.getElementById("save");
	if (!el) return;
	el.innerHTML =
		'<span>' + esc(lastSaveText || "已自動儲存 --") + '</span>' +
		'<span>JSON ' + (exportStatus.json ? "已匯出" : "未匯出") +
		' | TXT ' + (exportStatus.txt ? "已匯出" : "未匯出") + '</span>';
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
function bind(id, val, set) {
	const el = document.getElementById(id);
	if (document.activeElement !== el) el.value = val || "";
	el.oninput = () => {
		set(el.value);
		changed();
	};
	el.onchange = el.oninput;
}
function render() {
	renderPresets();
	renderFields();
	renderToggles();
	renderSections();
	renderOut();
}
function renderPresets() {
	const r = document.getElementById("templates");
	r.innerHTML = "";
	Object.entries(presets).forEach(([k, p]) => {
		const d = document.createElement("div");
		d.className = "card " + (state.noteType === k ? "active" : "");
		d.innerHTML =
			"<strong>" + esc(p.label) + "</strong><span>" + esc(p.desc) + "</span>";
		d.onclick = () => {
			if (confirm("切換模板會取代目前表單，確定？")) {
				state = makeState(k);
				changed();
				render();
			}
		};
		r.appendChild(d);
	});
}
function renderFields() {
	bind("title", state.title, (v) => (state.title = v));
	bind("status", state.status, (v) => (state.status = v));
	bind("summary", state.summary, (v) => (state.summary = v));
	bind("change", state.changeContent, (v) => (state.changeContent = v));
	bind("ref", state.relatedRef, (v) => (state.relatedRef = v));
	const e = document.getElementById("env");
	e.innerHTML = "";
	envKeys.forEach(([k, l]) => {
		const d = document.createElement("div");
		d.className = "field";
		d.innerHTML =
			"<label>" +
			esc(l) +
			"</label>" +
			(l === "CPLD 版本"
				? "<label> (ipmitool raw 0x32 0x1a 0xf1 / i2cget -y 7 0x071 0xf1)</label>"
				: "") +
			'<textarea data-env="' +
			k +
			'">' +
			esc(state.environment[k] || "") +
			"</textarea>";
		e.appendChild(d);
	});
	e.querySelectorAll("[data-env]").forEach(
		(x) =>
		(x.oninput = () => {
			state.environment[x.dataset.env] = x.value;
			changed();
		}),
	);
}
function renderToggles() {
	const r = document.getElementById("toggles");
	r.innerHTML = "";
	state.sections.forEach((s) => {
		const d = document.createElement("div");
		d.innerHTML =
			'<label style="color:var(--text)"><input type="checkbox" data-t="' +
			s.id +
			'" ' +
			(s.enabled ? "checked" : "") +
			"> " +
			esc(s.title) +
			"</label>";
		r.appendChild(d);
	});
	r.querySelectorAll("[data-t]").forEach(
		(x) =>
		(x.onchange = () => {
			findSec(x.dataset.t).enabled = x.checked;
			changed();
			render();
		}),
	);
}
function sectionActionsHtml(s, position = "top") {
	const extraClass = position === "bottom" ? " section-actions-bottom" : "";
	return (
		'<div class="actions' +
		extraClass +
		'"><button type="button" class="small" data-up="' +
		s.id +
		'">上移</button><button type="button" class="small" data-down="' +
		s.id +
		'">下移</button><button type="button" class="small" data-dup-section="' +
		s.id +
		'">複製段落</button><button type="button" class="small" data-add="' +
		s.id +
		'">新增區塊</button><button type="button" class="small danger" data-del-section="' +
		s.id +
		'">刪除段落</button></div>'
	);
}
function renderSections() {
	ensureSections();
	const r = document.getElementById("sections");
	r.innerHTML = "";
	state.sections.forEach((s) => {
		const d = document.createElement("div");
		d.className = "section";
		d.innerHTML =
			'<div class="section-head"><label style="color:var(--text);margin:0"><input type="checkbox" data-se="' +
			s.id +
			'" ' +
			(s.enabled ? "checked" : "") +
			'></label><button type="button" class="section-toggle" data-collapse-target="section-body-' +
			s.id +
			'" aria-expanded="' +
			(isCollapsedTarget('section-body-' + s.id) ? 'false' : 'true') +
			'"><strong>' +
			esc(s.title) +
			'</strong></button>' +
			sectionActionsHtml(s, "top") +
			'</div><div class="section-body" id="section-body-' +
			s.id +
			'"><div class="field"><label>段落標題 h3.</label><input type="text" data-st="' +
			s.id +
			'" value="' +
			esc(s.title) +
			'"></div><div class="field"><label>段落說明，輸出時前後各保留一個空白行</label><textarea style="min-height:90px" data-sdesc="' +
			s.id +
			'">' +
			esc(s.description || "") +
			'</textarea></div><div data-bs="' +
			s.id +
			'"></div>' +
			sectionActionsHtml(s, "bottom") +
			'</div>';
		r.appendChild(d);
		const br = d.querySelector("[data-bs]");
		(s.blocks || []).forEach((b) => br.appendChild(renderBlock(s.id, b)));
	});
	r.querySelectorAll("[data-se]").forEach(
		(x) =>
		(x.onchange = () => {
			findSec(x.dataset.se).enabled = x.checked;
			changed();
			render();
		}),
	);
	r.querySelectorAll("[data-st]").forEach(
		(x) =>
		(x.oninput = () => {
			findSec(x.dataset.st).title = x.value;
			changed();
			renderToggles();
			renderOut();
		}),
	);
	r.querySelectorAll("[data-sdesc]").forEach(
		(x) =>
		(x.oninput = () => {
			findSec(x.dataset.sdesc).description = x.value;
			changed();
			renderOut();
		}),
	);
	r.querySelectorAll("[data-add]").forEach((x) => (x.onclick = () => addBlock(x.dataset.add)));
	r.querySelectorAll("[data-up]").forEach((x) => (x.onclick = () => moveSec(x.dataset.up, -1)));
	r.querySelectorAll("[data-down]").forEach((x) => (x.onclick = () => moveSec(x.dataset.down, 1)));
	r.querySelectorAll("[data-dup-section]").forEach((x) => (x.onclick = () => duplicateSection(x.dataset.dupSection)));
	r.querySelectorAll("[data-del-section]").forEach((x) => (x.onclick = () => deleteSection(x.dataset.delSection)));
	applySavedCollapseState(r);
}
function renderBlock(sid, b) {
	const d = document.createElement("div");
	d.className = "block";
	ensureBlockContents(b);
	const options = [
		"implementation",
		"text",
		"command",
		"diff",
		"log",
		"mermaid",
		"image",
		"collapse",
	]
		.map(
			(t) =>
				'<option value="' +
				t +
				'" ' +
				(b.type === t ? "selected" : "") +
				">" +
				label(t) +
				"</option>",
		)
		.join("");
	const headerHtml =
		'<div class="actions" style="justify-content:space-between"><span class="note">' +
		(b.type === "implementation" ? "Implementation Unit" : label(b.type)) +
		'</span><span><button type="button" class="small" data-block-up="' +
		b.id +
		'">上移</button> <button type="button" class="small" data-block-down="' +
		b.id +
		'">下移</button> <button type="button" class="small" data-du="' +
		b.id +
		'">複製</button> <button type="button" class="small danger" data-del="' +
		b.id +
		'">刪除</button></span></div>';
	const typeTitleHtml =
		'<div class="row"><div class="field"><label>區塊類型</label><select data-btype="' +
		b.id +
		'">' +
		options +
		'</select></div><div class="field"><label>' +
		(b.type === "implementation" ? "檔名 / 單位標題，輸出為 # xxx" : "區塊標題") +
		'</label><input type="text" data-btitle="' +
		b.id +
		'" value="' +
		esc(b.title || (b.type === "implementation" ? "api.c" : "")) +
		'"></div></div>';
	const contentItemsHtml = b.contents
		.map(
			(content, index) =>
				'<div class="content-item block"><div class="actions" style="justify-content:space-between"><span class="note">' +
				label(b.type) +
				' content #' +
				(index + 1) +
				'</span><span><button type="button" class="small" data-dup-content="' +
				index +
				'">複製</button> <button type="button" class="small danger" data-del-content="' +
				index +
				'">刪除</button></span></div><div class="field"><label>' +
				(b.type === "implementation" ? '主要內容，輸出到 &lt;pre&gt;&lt;code class="..."&gt;' : "內容") +
				'</label><textarea style="min-height:' +
				(b.type === "implementation" ? "170" : "130") +
				'px" data-cont-index="' +
				index +
				'">' +
				esc(content || "") +
				"</textarea></div></div>",
		)
		.join("");
	const addContentHtml =
		'<div class="actions" style="margin-bottom:8px"><button type="button" class="small primary" data-add-content="' +
		b.id +
		'">新增 content</button></div><div data-contents="' +
		b.id +
		'">' +
		contentItemsHtml +
		"</div>";
	if (b.type === "implementation") {
		d.innerHTML =
			headerHtml +
			typeTitleHtml +
			'<div class="row"><div class="field"><label><input type="checkbox" data-show-work="' +
			b.id +
			'" ' +
			(b.showWorkPath !== false ? "checked" : "") +
			'> 輸出 work path block</label><input type="text" data-work-title="' +
			b.id +
			'" value="' +
			esc(b.workPathTitle || "work path") +
			'" placeholder="collapse 顯示文字，例如 work path / source path"><textarea data-work="' +
			b.id +
			'">' +
			esc(b.workPath || "(docker)$ pwd") +
			'</textarea></div><div class="field"><label>主要內容語言 class</label><input type="text" data-lang="' +
			b.id +
			'" value="' +
			esc(b.codeLang || "cpp") +
			'"></div></div><div class="field"><label>Description 簡述內容</label><textarea data-desc="' +
			b.id +
			'">' +
			esc(b.description || "") +
			"</textarea></div>" +
			addContentHtml;
	} else {
		d.innerHTML = headerHtml + typeTitleHtml + addContentHtml;
	}
	d.querySelector("[data-btype]").onchange = (e) => {
		b.type = e.target.value;
		if (b.type === "implementation") {
			b.workPath = b.workPath || "(docker)$ pwd";
			b.workPathTitle = b.workPathTitle || "work path";
			b.showWorkPath = b.showWorkPath !== false;
			b.codeLang = b.codeLang || "cpp";
			b.description = b.description || "";
			b.title = b.title || "api.c";
		}
		ensureBlockContents(b);
		changed();
		render();
	};
	d.querySelector("[data-btitle]").oninput = (e) => {
		b.title = e.target.value;
		changed();
		renderOut();
	};
	d.querySelectorAll("[data-cont-index]").forEach((x) => {
		x.oninput = (e) => {
			ensureBlockContents(b);
			b.contents[Number(x.dataset.contIndex)] = e.target.value;
			syncBlockContent(b);
			changed();
			renderOut();
		};
	});
	d.querySelectorAll("[data-del-content]").forEach((x) => {
		x.onclick = () => deleteBlockContent(b, Number(x.dataset.delContent));
	});
	d.querySelectorAll("[data-dup-content]").forEach((x) => {
		x.onclick = () => duplicateBlockContent(b, Number(x.dataset.dupContent));
	});
	const addContentButton = d.querySelector("[data-add-content]");
	if (addContentButton) addContentButton.onclick = () => addBlockContent(b);
	const w = d.querySelector("[data-work]");
	if (w)
		w.oninput = (e) => {
			b.workPath = e.target.value;
			changed();
			renderOut();
		};
	const wt = d.querySelector("[data-work-title]");
	if (wt)
		wt.oninput = (e) => {
			b.workPathTitle = e.target.value;
			changed();
			renderOut();
		};
	const sw = d.querySelector("[data-show-work]");
	if (sw)
		sw.onchange = (e) => {
			b.showWorkPath = e.target.checked;
			changed();
			renderOut();
		};
	const l = d.querySelector("[data-lang]");
	if (l)
		l.oninput = (e) => {
			b.codeLang = e.target.value;
			changed();
			renderOut();
		};
	const desc = d.querySelector("[data-desc]");
	if (desc)
		desc.oninput = (e) => {
			b.description = e.target.value;
			changed();
			renderOut();
		};
	d.querySelector("[data-block-up]").onclick = () => moveBlock(sid, b.id, -1);
	d.querySelector("[data-block-down]").onclick = () => moveBlock(sid, b.id, 1);
	d.querySelector("[data-del]").onclick = () => {
		findSec(sid).blocks = findSec(sid).blocks.filter((x) => x.id !== b.id);
		changed();
		render();
	};
	d.querySelector("[data-du]").onclick = () => {
		const nb = JSON.parse(JSON.stringify(b));
		nb.id = uid();
		nb.title = (nb.title || "") + " copy";
		findSec(sid).blocks.push(nb);
		changed();
		render();
	};
	return d;
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

function addSection(title = "") {
	ensureSections();

	const inputTitle =
		title ||
		prompt("段落標題 h3.", "新增段落");

	if (inputTitle === null) return;

	const nextTitle = String(inputTitle).trim() || "新增段落";
	state.sections.push(sec(nextTitle, true, []));

	changed();
	render();
}

function deleteSection(id) {
	ensureSections();

	const target = findSec(id);
	if (!target) return;

	if (!confirm("刪除段落「" + target.title + "」？段落內的區塊也會一起刪除。")) {
		return;
	}

	state.sections = state.sections.filter((s) => s.id !== id);

	changed();
	render();
}

function duplicateSection(id) {
	ensureSections();
	const target = findSec(id);
	if (!target) return;

	const copied = JSON.parse(JSON.stringify(target));
	copied.id = uid();
	copied.title = (copied.title || "段落") + " copy";
	copied.blocks = (copied.blocks || []).map((b) => ({
		...b,
		id: uid(),
	}));

	const index = state.sections.findIndex((s) => s.id === id);
	state.sections.splice(index + 1, 0, copied);
	changed();
	render();
}
function moveBlock(sid, bid, dir) {
	const s = findSec(sid);
	if (!s || !Array.isArray(s.blocks)) return;
	const i = s.blocks.findIndex((b) => b.id === bid);
	const j = i + dir;
	if (i < 0 || j < 0 || j >= s.blocks.length) return;
	[s.blocks[i], s.blocks[j]] = [s.blocks[j], s.blocks[i]];
	changed();
	render();
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
function addBlockContent(b) {
	ensureBlockContents(b);
	b.contents.push("");
	syncBlockContent(b);
	changed();
	render();
}
function deleteBlockContent(b, index) {
	ensureBlockContents(b);
	if (b.contents.length <= 1) b.contents[0] = "";
	else b.contents.splice(index, 1);
	syncBlockContent(b);
	changed();
	render();
}
function duplicateBlockContent(b, index) {
	ensureBlockContents(b);
	b.contents.splice(index + 1, 0, b.contents[index] ?? "");
	syncBlockContent(b);
	changed();
	render();
}
let pendingAddSectionId = null;
function blockTypeOptionsHtml() {
	return [
		["implementation", "Implementation Unit"],
		["text", "Text / Textile"],
		["command", "Command block"],
		["diff", "Diff block"],
		["log", "Log block"],
		["mermaid", "Mermaid block"],
		["image", "Image"],
		["collapse", "Collapse"],
	]
		.map(
			([value, text]) => '<option value="' + value + '">' + text + "</option>",
		)
		.join("");
}
function defaultBlockTitle(type) {
	return type === "implementation" ? "api.c" : label(type);
}
function ensureAddBlockDialog() {
	let dialog = document.getElementById("addBlockDialog");
	if (dialog) return dialog;
	dialog = document.createElement("dialog");
	dialog.id = "addBlockDialog";
	dialog.className = "add-block-dialog";
	dialog.innerHTML =
		'<form method="dialog" id="addBlockForm"><div class="dialog-head">新增區塊</div><div class="dialog-body"><div class="field"><label>區塊類型</label><select id="addBlockType">' +
		blockTypeOptionsHtml() +
		'</select></div><div class="field"><label>區塊標題</label><input id="addBlockTitle" type="text"></div></div><div class="dialog-actions"><button type="button" id="addBlockCancel">取消</button><button type="submit" class="primary">新增</button></div></form>';
	document.body.appendChild(dialog);
	const type = dialog.querySelector("#addBlockType");
	const title = dialog.querySelector("#addBlockTitle");
	type.onchange = () => {
		title.value = defaultBlockTitle(type.value);
	};
	dialog.querySelector("#addBlockCancel").onclick = () => {
		pendingAddSectionId = null;
		dialog.close();
	};
	dialog.querySelector("#addBlockForm").onsubmit = (e) => {
		e.preventDefault();
		if (!pendingAddSectionId) return;
		const selectedType = type.value || "text";
		const selectedTitle = title.value || defaultBlockTitle(selectedType);
		findSec(pendingAddSectionId).blocks.push(
			selectedType === "implementation"
				? impl(selectedTitle || "api.c")
				: block(selectedType, selectedTitle, ""),
		);
		pendingAddSectionId = null;
		dialog.close();
		changed();
		render();
	};
	return dialog;
}
function addBlock(id) {
	if (typeof HTMLDialogElement === "undefined") {
		const t =
			prompt(
				"區塊類型：Implementation Unit (implementation) / text / command / diff / log / mermaid / image / collapse",
				"implementation",
			) || "text";
		const title = prompt("區塊標題", defaultBlockTitle(t)) || "";
		findSec(id).blocks.push(
			t === "implementation" ? impl(title || "api.c") : block(t, title, ""),
		);
		changed();
		render();
		return;
	}
	pendingAddSectionId = id;
	const dialog = ensureAddBlockDialog();
	const type = dialog.querySelector("#addBlockType");
	const title = dialog.querySelector("#addBlockTitle");
	type.value = "implementation";
	title.value = defaultBlockTitle(type.value);
	dialog.showModal();
	title.focus();
	title.select();
}
function moveSec(id, dir) {
	const i = state.sections.findIndex((s) => s.id === id),
		j = i + dir;
	if (i < 0 || j < 0 || j >= state.sections.length) return;
	[state.sections[i], state.sections[j]] = [
		state.sections[j],
		state.sections[i],
	];
	changed();
	render();
}
function changed() {
	exportStatus.json = false;
	exportStatus.txt = false;
	save();
	renderOut();
}
function addH3(o, title) {
	o.push("h3. " + title);
	o.push("");
}
function textile() {
	const o = [];
	o.push("h2. " + (state.title || ""));
	if (state.relatedRef) {
		o.push("");
		o.push(state.relatedRef);
	}
	o.push("");
	if (state.status !== "N/A") {
		addH3(o, "結論");
		o.push("執行狀態: " + status(state.status));
	}
	lines(state.summary).forEach((x) => o.push("* " + x));
	const changeContent = String(state.changeContent ?? "").trim();
	if (changeContent) {
		o.push("");
		addH3(o, "修改目標");
		if (changeContent === "X") {
			o.push("修改內容: X");
		} else {
			o.push("修改內容:");
			o.push(state.changeContent || "");
		}
		o.push("");
	}
	else {
		o.push("");
	}

	const environmentLines = envKeys
		.map(([k, l]) => {
			const v = String(state.environment[k] ?? "").trim();
			return v ? "* " + l + ": " + v : "";
		})
		.filter(Boolean);
	if (environmentLines.length) {
		addH3(o, "測試環境");
		o.push(...environmentLines);
		o.push("");
	}
	state.sections
		.filter((s) => s.enabled)
		.forEach((s) => {
			addH3(o, s.title);
			if ((s.description || "").trim()) {
				o.push(s.description || "");
				o.push("");
			}
			(s.blocks || []).forEach((b) => push(o, b));
			o.push("");
		});
	return (
		o
			.join("\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim() + "\n"
	);
}
function status(s) {
	return s === "PASS"
		? "%{color:green}PASS%"
		: s === "FAILED"
			? "%{color:red}FAILED%"
			: s === "WIP"
				? "%{color:orange}WIP%"
				: "N/A";
}
function push(o, b) {
	const title = (b.title || "").trim();
	const contents = getBlockContents(b).filter((x) => String(x || "").trim());
	if (b.type === "implementation") {
		o.push("# " + (title || "api.c"));
		if (b.showWorkPath !== false) {
			o.push("{{collapse(" + (b.workPathTitle || "work path") + ")");
			o.push('<pre><code class="shell">');
			o.push(b.workPath || "(docker)$ pwd");
			o.push("</code></pre>");
			o.push("}}");
		}
		if ((b.description || "").trim()) {
			o.push(b.description || "");
		}
		(contents.length ? contents : [""]).forEach((content) => {
			o.push(' <pre><code class="' + (b.codeLang || "cpp") + '">');
			o.push(content);
			o.push("</code></pre>");		});
		return;
	}
	if (title && b.type !== "image") o.push("# " + title);
	if (["command", "diff", "log"].includes(b.type)) {
		contents.forEach((content) => {
			if (["diff", "log"].includes(b.type))
				o.push(" <pre><code class=\"" + b.type + "\">");
			else
				o.push(" <pre><code class=\"shell\">");
			o.push(content);
			o.push("</code></pre>");
		});
	} else if (b.type === "mermaid") {
		contents.forEach((content) => {
			o.push(" {{mermaid");
			o.push(content);
			o.push("}}");
		});
	} else if (b.type === "image") {
		contents.forEach((content) => {
			lines(content).forEach((x) => o.push("!" + x.replace(/^!|!$/g, "") + "!"));
		});
	} else if (b.type === "collapse") {
		contents.forEach((content, index) => {
			const suffix = contents.length > 1 ? " #" + (index + 1) : "";
			o.push(" {{collapse(" + (title || "detail") + suffix + ")");
			o.push(content);
			o.push("}}");
		});
	} else {
		contents.forEach((content) => o.push(content));
	}
}

function escapePreviewHtml(s) {
	return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
function renderInlineTextile(s) {
	let text = escapePreviewHtml(s);
	text = text.replace(/%\{color:([^}]+)\}([^%]+)%/g, '<span style="color:$1">$2</span>');
	text = text.replace(/@([^@]+)@/g, '<code>$1</code>');
	text = text.replace(/"([^"]+)":(https?:\/\/[^\s]+)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
	return text;
}

function parsePreviewTableRow(trimmed) {
	const cells = trimmed
		.slice(1, -1)
		.split("|")
		.map((cell) => cell.trim());

	const hasHeaderCell = cells.some((cell) => cell.startsWith("_."));

	return (
		"<tr>" +
		cells
			.map((cell) => {
				const isHeader = cell.startsWith("_.");
				const clean = isHeader ? cell.replace(/^_\.\s*/, "") : cell;
				const tag = isHeader || hasHeaderCell ? "th" : "td";
				return "<" + tag + ">" + renderInlineTextile(clean) + "</" + tag + ">";
			})
			.join("") +
		"</tr>"
	);
}

function textileToPreviewHtml(text) {
	const inputLines = String(text ?? "")
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.split("\n");
	const html = [];
	let inList = null;
	let inTable = false;

	let inPre = false;
	let preLang = "";
	let preLines = [];

	let inCollapse = false;
	let collapseTitle = "detail";
	let collapseLines = [];

	let inMermaid = false;
	let mermaidLines = [];

	const closeList = () => {
		if (!inList) return;
		html.push("</" + inList + ">");
		inList = null;
	};

	const closeTable = () => {
		if (!inTable) return;
		html.push("</table>");
		inTable = false;
	};

	const closeFlowBlocks = () => {
		closeList();
		closeTable();
	};
	const flushPre = () => {
		html.push(
			"<pre><code" +
				(preLang ? ' class="' + escapePreviewHtml(preLang) + '"' : "") +
				">" +
				escapePreviewHtml(preLines.join("\n")) +
				"</code></pre>",
		);
		inPre = false;
		preLang = "";
		preLines = [];
	};
	const renderPlainBlock = (lines) => textileToPreviewHtml(lines.join("\n"));
	for (const rawLine of inputLines) {
		const trimmed = rawLine.trim();
		if (inPre) {
			if (trimmed === "</code></pre>" || trimmed === "</pre>") flushPre();
			else preLines.push(rawLine);
			continue;
		}
		if (inMermaid) {
			if (trimmed === "}}") {
				closeFlowBlocks();
				html.push(
					'<div class="preview-placeholder"><strong>Mermaid</strong><pre><code>' +
						escapePreviewHtml(mermaidLines.join("\n")) +
						"</code></pre></div>",
				);
				inMermaid = false;
				mermaidLines = [];
			} else mermaidLines.push(rawLine);
			continue;
		}
		if (inCollapse) {
			if (trimmed === "}}") {
				closeFlowBlocks();
				html.push(
					"<details><summary>" +
						renderInlineTextile(collapseTitle) +
						'</summary><div class="preview-collapse-body">' +
						renderPlainBlock(collapseLines) +
						"</div></details>",
				);
				inCollapse = false;
				collapseTitle = "detail";
				collapseLines = [];
			} else collapseLines.push(rawLine);
			continue;
		}
		if (!trimmed) {
			closeFlowBlocks();
			continue;
		}
		const inlinePreMatch = trimmed.match(
			/^<pre><code(?: class=["']?([^"'>]+)["']?)?>([\s\S]*)<\/code><\/pre>$/i,
		);

		if (inlinePreMatch) {
			closeFlowBlocks();
			html.push(
				"<pre><code" +
					(inlinePreMatch[1]
						? ' class="' + escapePreviewHtml(inlinePreMatch[1]) + '"'
						: "") +
					">" +
					escapePreviewHtml(inlinePreMatch[2]) +
					"</code></pre>",
			);
			continue;
		}

		const preMatch = trimmed.match(
			/^<pre><code(?: class=["']?([^"'>]+)["']?)?>$/i,
		);
		if (preMatch) {
			closeFlowBlocks();
			inPre = true;
			preLang = preMatch[1] || "";
			preLines = [];
			continue;
		}
		const collapseMatch = trimmed.match(/^\{\{collapse\((.*)\)$/);
		if (collapseMatch) {
			closeFlowBlocks();
			inCollapse = true;
			collapseTitle = collapseMatch[1] || "detail";
			collapseLines = [];
			continue;
		}
		if (trimmed === "{{mermaid") {
			closeFlowBlocks();
			inMermaid = true;
			mermaidLines = [];
			continue;
		}
		if (/^\|.+\|$/.test(trimmed)) {
			closeList();

			if (!inTable) {
				html.push('<table class="preview-table">');
				inTable = true;
			}

			html.push(parsePreviewTableRow(trimmed));
			continue;
		}

		if (/^h2\.\s+/.test(trimmed)) {
			closeFlowBlocks();
			html.push(
				"<h2>" + renderInlineTextile(trimmed.replace(/^h2\.\s+/, "")) + "</h2>",
			);
			continue;
		}
		if (/^h3\.\s+/.test(trimmed)) {
			closeFlowBlocks();
			html.push(
				"<h3>" + renderInlineTextile(trimmed.replace(/^h3\.\s+/, "")) + "</h3>",
			);
			continue;
		}
		if (/^\*\s+/.test(trimmed)) {
			closeTable();
			if (inList !== "ul") {
				closeList();
				html.push("<ul>");
				inList = "ul";
			}
			html.push(
				"<li>" + renderInlineTextile(trimmed.replace(/^\*\s+/, "")) + "</li>",
			);
			continue;
		}
		if (/^#\s+/.test(trimmed)) {
			closeTable();
			if (inList !== "ol") {
				closeList();
				html.push("<ol>");
				inList = "ol";
			}
			html.push(
				"<li>" + renderInlineTextile(trimmed.replace(/^#\s+/, "")) + "</li>",
			);
			continue;
		}
		const imageMatch = trimmed.match(/^!(.+)!$/);
		if (imageMatch) {
			closeFlowBlocks();
			html.push(
				'<img src="' +
					escapePreviewHtml(imageMatch[1]) +
					'" alt="Redmine image preview">',
			);
			continue;
		}
		closeFlowBlocks();
		html.push("<p>" + renderInlineTextile(trimmed) + "</p>");
	}
	if (inPre) flushPre();
	if (inMermaid)
		html.push(
			'<div class="preview-placeholder"><strong>Mermaid</strong><pre><code>' +
				escapePreviewHtml(mermaidLines.join("\n")) +
				"</code></pre></div>",
		);
	if (inCollapse)
		html.push(
			"<details><summary>" +
				renderInlineTextile(collapseTitle) +
				'</summary><div class="preview-collapse-body">' +
				renderPlainBlock(collapseLines) +
				"</div></details>",
		);
	closeFlowBlocks();
	return html.join("\n") || '<p class="note">尚無可預覽內容</p>';
}


function syncOutputViewButtons() {
	const rawButton = document.getElementById("raw");
	const previewButton = document.getElementById("previewbtn");
	const jsonButton = document.getElementById("statebtn");
	if (rawButton) {
		rawButton.classList.toggle("primary", view === "raw");
		rawButton.setAttribute("aria-pressed", String(view === "raw"));
	}
	if (previewButton) {
		previewButton.classList.toggle("primary", view === "preview");
		previewButton.setAttribute("aria-pressed", String(view === "preview"));
	}
	if (jsonButton) {
		jsonButton.classList.toggle("primary", view === "json");
		jsonButton.setAttribute("aria-pressed", String(view === "json"));
	}
}
function renderOut() {
	const out = document.getElementById("out");
	const preview = document.getElementById("preview");
	const rawText = textile();
	if (out) {
		out.value = view === "json" ? JSON.stringify(state, null, 2) : rawText;
		out.classList.toggle("hidden", view === "preview");
	}
	if (preview) {
		preview.classList.toggle("hidden", view !== "preview");
		if (view === "preview") preview.innerHTML = textileToPreviewHtml(rawText);
	}
	syncOutputViewButtons();
}

const rawButton = document.getElementById("raw");
if (rawButton) {
	rawButton.onclick = () => {
		view = "raw";
		renderOut();
	};
}

const previewButton = document.getElementById("previewbtn");
if (previewButton) {
	previewButton.onclick = () => {
		view = "preview";
		renderOut();
	};
}

const stateButton = document.getElementById("statebtn");
if (stateButton) {
	stateButton.onclick = () => {
		view = "json";
		renderOut();
	};
};
document.getElementById("copy").onclick = async () => {
	const t = textile();
	try {
		await navigator.clipboard.writeText(t);
	} catch {
		const o = document.getElementById("out");
		o.select();
		document.execCommand("copy");
	}
	alert("已複製");
};
function download(fn, txt, type) {
	const a = document.createElement("a"),
		u = URL.createObjectURL(new Blob([txt], { type }));
	a.href = u;
	a.download = fn;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(u);
}
function safe(s) {
	return String(s || "redmine-note")
		.replace(/[\\/:*?"<>|\s]+/g, "_")
		.slice(0, 80);
}
document.getElementById("txt").onclick = () => {
	download(safe(state.title) + ".textile", textile(), "text/plain");
	exportStatus.txt = true;
	renderSaveStatus();
};
document.getElementById("json").onclick = () => {
	download(
		safe(state.title) + ".json",
		JSON.stringify(state, null, 2),
		"application/json",
	);
	exportStatus.json = true;
	renderSaveStatus();
};
document.getElementById("import").onclick = () =>
	document.getElementById("file").click();
document.getElementById("file").onchange = (e) => {
	const f = e.target.files[0];
	if (!f) return;
	const r = new FileReader();
	r.onload = () => {
		try {
			const obj = JSON.parse(r.result);
			if (!obj.environment || !Array.isArray(obj.sections)) throw new Error("格式不符合");
			state = obj;
			changed();
			render();
		} catch (err) {
			alert("JSON 匯入失敗：" + err.message);
		}
	};
	r.readAsText(f);
	e.target.value = "";
};

function normalizePatchPath(path) {
	return String(path || "")
		.trim()
		.replace(/^"|"$/g, "")
		.replace(/^[ab]\//, "")
		.replace(/^\.\//, "");
}
function patchPathDir(path) {
	const normalized = normalizePatchPath(path);
	const i = normalized.lastIndexOf("/");
	return i >= 0 ? normalized.slice(0, i) : ".";
}
function patchPathFileName(path) {
	const normalized = normalizePatchPath(path);
	const i = normalized.lastIndexOf("/");
	return i >= 0 ? normalized.slice(i + 1) : normalized || "patch.diff";
}
function parsePatchToImplementationUnits(text) {
	const lines = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
	const units = [];
	let current = null;

	function finishCurrent() {
		if (!current || !current.lines.length) return;
		let path = current.newPath || current.oldPath || current.gitPath || "patch.diff";
		if (path === "/dev/null") path = current.oldPath || current.gitPath || "patch.diff";
		const content = current.lines.join("\n").trim();
		if (!content) return;
		units.push(
			impl(
				patchPathFileName(path),
				patchPathDir(path),
				"diff",
				content,
				"",
			),
		);
	}

	lines.forEach((line) => {
		const gitMatch = line.match(/^diff --git\s+(?:"?a\/(.+?)"?)\s+(?:"?b\/(.+?)"?)\s*$/);
		if (gitMatch) {
			finishCurrent();
			current = {
				gitPath: normalizePatchPath(gitMatch[2] || gitMatch[1]),
				oldPath: normalizePatchPath(gitMatch[1]),
				newPath: normalizePatchPath(gitMatch[2]),
				lines: [line],
			};
			return;
		}

		if (!current && /^---\s+/.test(line)) {
			current = { gitPath: "", oldPath: "", newPath: "", lines: [] };
		}
		if (!current) return;

		const oldMatch = line.match(/^---\s+(?:"?(.+?)"?)\s*$/);
		if (oldMatch) {
			current.oldPath = normalizePatchPath(oldMatch[1]);
		}
		const newMatch = line.match(/^\+\+\+\s+(?:"?(.+?)"?)\s*$/);
		if (newMatch) {
			current.newPath = normalizePatchPath(newMatch[1]);
		}
		current.lines.push(line);
	});
	finishCurrent();
	return units;
}
function findOrCreateImplementationSection() {
	let s = state.sections.find((x) => x.title === "實作流程");
	if (!s) {
		s = sec("實作流程", true, []);
		state.sections.push(s);
	}
	s.enabled = true;
	return s;
}
function importPatchText(text, fileName = "patch.diff") {
	const units = parsePatchToImplementationUnits(text);
	if (!units.length) {
		alert("Patch 匯入失敗：找不到可轉換的 diff 區塊");
		return;
	}
	const s = findOrCreateImplementationSection();
	s.blocks.push(...units);
	changed();
	render();
	alert("已從 " + fileName + " 匯入 " + units.length + " 個 Implementation Unit");
}


document.getElementById("patch").onclick = () =>
	document.getElementById("patchFile").click();
document.getElementById("patchFile").onchange = (e) => {
	const f = e.target.files[0];
	if (!f) return;
	const r = new FileReader();
	r.onload = () => importPatchText(r.result, f.name);
	r.readAsText(f);
	e.target.value = "";
};

document.getElementById("reset").onclick = () => {
	if (confirm("清除 localStorage 並重設？")) {
		localStorage.removeItem(KEY);
		state = makeState();
		changed();
		render();
	}
};
document.querySelectorAll("[data-snip]").forEach(
	(b) =>
	(b.onclick = () => {
		let s = state.sections.find((x) => x.title === "結果驗證");
		if (b.dataset.snip === "impl")
			s = state.sections.find((x) => x.title === "實作流程");
		if (!s) {
			s = sec(b.dataset.snip === "impl" ? "實作流程" : "結果驗證", true, []);
			state.sections.push(s);
		}
		s.enabled = true;
		if (b.dataset.snip === "impl")
			s.blocks.push(impl("api.c", "(docker)$ pwd", "cpp", ""));
		if (b.dataset.snip === "journalctl")
			s.blocks.push(
				block(
					"command",
					"journalctl",
					"root@bmc-host:~# journalctl -o short-precise | grep obmc-console-server\n...",
				),
			);
		if (b.dataset.snip === "systemctl")
			s.blocks.push(
				block(
					"command",
					"systemctl",
					"root@bmc-host:~# systemctl status obmc-console@ttyS0.service -l\n...",
				),
			);
		if (b.dataset.snip === "i2c")
			s.blocks.push(
				block(
					"command",
					"i2cget/set",
					"root@bmc-host:~# i2cget -y 7 0x71 0xc\n0x00\nroot@bmc-host:~# i2cset -y 7 0x71 0xc 0x2",
				),
			);
		changed();
		render();
	}),
);

function animateCollapse(target, shouldCollapse) {
	const finish = () => {
		target.removeEventListener("transitionend", finish);

		if (shouldCollapse) {
			target.style.height = "";
		} else {
			target.style.height = "";
			target.classList.remove("collapsed");
		}
	};

	target.removeEventListener("transitionend", finish);

	if (shouldCollapse) {
		const height = target.scrollHeight;
		target.style.height = height + "px";

		requestAnimationFrame(() => {
			target.classList.add("collapsed");
			target.style.height = "0px";
			target.addEventListener("transitionend", finish);
		});
	} else {
		target.classList.remove("collapsed");
		target.style.height = "0px";

		requestAnimationFrame(() => {
			const height = target.scrollHeight;
			target.style.height = height + "px";
			target.addEventListener("transitionend", finish);
		});
	}
}



function setupThemeToggle() {
	const btn = document.getElementById("themeToggle");
	const storageKey = KEY + ":theme";
	const getSystemTheme = () =>
		window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	const getSavedTheme = () => localStorage.getItem(storageKey);
	const applyTheme = (theme) => {
		const nextTheme = theme === "dark" ? "dark" : "light";
		document.body.dataset.theme = nextTheme;
		if (!btn) return;
		const isDark = nextTheme === "dark";
		btn.textContent = isDark ? "淺色模式" : "深色模式";
		btn.setAttribute("aria-pressed", String(isDark));
		btn.setAttribute("aria-label", isDark ? "切換為淺色模式" : "切換為深色模式");
		btn.title = isDark ? "切換為淺色模式" : "切換為深色模式";
	};
	applyTheme(getSavedTheme() || getSystemTheme());
	if (btn) {
		btn.onclick = () => {
			const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
			localStorage.setItem(storageKey, nextTheme);
			applyTheme(nextTheme);
		};
	}
	if (window.matchMedia) {
		const query = window.matchMedia("(prefers-color-scheme: dark)");
		const syncSystemTheme = () => {
			if (!getSavedTheme()) applyTheme(getSystemTheme());
		};
		if (typeof query.addEventListener === "function") {
			query.addEventListener("change", syncSystemTheme);
		} else {
			query.addListener(syncSystemTheme);
		}
	}
}

function setupMobileHeaderCollapse() {
	const header = document.getElementById("siteHeader");
	const toggle = document.getElementById("headerMenuToggle");
	const actions = document.getElementById("headerActions");
	if (!header || !toggle || !actions) return;

	const mobileQuery = window.matchMedia("(max-width: 760px)");
	const setExpanded = (expanded) => {
		header.classList.toggle("is-collapsed", !expanded);
		toggle.setAttribute("aria-expanded", String(expanded));
		toggle.setAttribute("aria-label", expanded ? "收合頁首選單" : "展開頁首選單");
	};
	const syncMode = () => setExpanded(!mobileQuery.matches);

	toggle.onclick = () => {
		const expanded = toggle.getAttribute("aria-expanded") === "true";
		setExpanded(!expanded);
	};

	if (typeof mobileQuery.addEventListener === "function") {
		mobileQuery.addEventListener("change", syncMode);
	} else {
		mobileQuery.addListener(syncMode);
	}

	syncMode();
}

function setupCollapsible() {
	document.addEventListener("click", (e) => {
		const toggle = e.target.closest("[data-collapse-target]");
		if (!toggle) return;

		const target = document.getElementById(toggle.dataset.collapseTarget);
		if (!target) return;

		const expanded = toggle.getAttribute("aria-expanded") !== "false";
		const nextExpanded = !expanded;

		toggle.setAttribute("aria-expanded", String(nextExpanded));
		setCollapsedTarget(toggle.dataset.collapseTarget, !nextExpanded);
		animateCollapse(target, expanded);
	});
	applySavedCollapseState();
}

function setupSidebarCollapse() {
	const layout = document.getElementById("appLayout");
	const btn = document.getElementById("sidebarCollapse");
	const body = document.getElementById("panel-templates");
	if (!layout || !btn || !body) return;

	const mobileQuery = window.matchMedia("(max-width: 760px)");

	const setMobileExpanded = (expanded, animate = false) => {
		btn.textContent = "模板與段落";
		btn.setAttribute("aria-expanded", String(expanded));
		btn.setAttribute("aria-label", expanded ? "收合模板與段落" : "展開模板與段落");
		btn.title = expanded ? "收合模板與段落" : "展開模板與段落";
		if (animate) {
			animateCollapse(body, !expanded);
		} else {
			body.classList.toggle("collapsed", !expanded);
		}
	};

	const setDesktopCollapsed = (collapsed) => {
		layout.classList.toggle("sidebar-collapsed", collapsed);
		btn.textContent = collapsed ? "☰" : "‹";
		btn.removeAttribute("aria-expanded");
		btn.setAttribute("aria-label", collapsed ? "展開模板與段落" : "收合模板與段落");
		btn.title = collapsed ? "展開模板與段落" : "收合模板與段落";
		body.classList.remove("collapsed");
	};

	const syncMode = () => {
		if (mobileQuery.matches) {
			layout.classList.remove("sidebar-collapsed");
			setMobileExpanded(true, false);
			return;
		}
		const saved = localStorage.getItem(KEY + ":sidebarCollapsed") === "1";
		setDesktopCollapsed(saved);
	};

	btn.onclick = () => {
		if (mobileQuery.matches) {
			const expanded = btn.getAttribute("aria-expanded") !== "false";
			setMobileExpanded(!expanded, true);
			return;
		}
		const collapsed = !layout.classList.contains("sidebar-collapsed");
		localStorage.setItem(KEY + ":sidebarCollapsed", collapsed ? "1" : "0");
		setDesktopCollapsed(collapsed);
	};

	if (typeof mobileQuery.addEventListener === "function") {
		mobileQuery.addEventListener("change", syncMode);
	} else {
		mobileQuery.addListener(syncMode);
	}

	syncMode();
}

function setupResizablePanels() {
	const layout = document.getElementById("appLayout");
	const resizer = document.getElementById("formOutputResizer");
	if (!layout || !resizer) return;
	const saved = localStorage.getItem(KEY + ":formWidth");
	if (saved) layout.style.setProperty("--form-width", saved + "px");
	let dragging = false;
	const startDrag = (e) => {
		dragging = true;
		resizer.classList.add("dragging");
		document.body.classList.add("resizing");
		e.preventDefault();
	};
	const move = (e) => {
		if (!dragging) return;
		const rect = layout.getBoundingClientRect();
		const sidebar = layout.classList.contains("sidebar-collapsed") ? 48 : 260;
		const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
		const gapAndResizer = 32;
		const minForm = 360;
		const minOutput = 420;
		const maxForm = Math.max(
			minForm,
			rect.width - sidebar - minOutput - gapAndResizer,
		);
		const next = Math.min(Math.max(x - sidebar - 12, minForm), maxForm);
		layout.style.setProperty("--form-width", next + "px");
		localStorage.setItem(KEY + ":formWidth", String(Math.round(next)));
	};
	const stop = () => {
		if (!dragging) return;
		dragging = false;
		resizer.classList.remove("dragging");
		document.body.classList.remove("resizing");
	};
	resizer.addEventListener("mousedown", startDrag);
	resizer.addEventListener("touchstart", startDrag, { passive: false });
	window.addEventListener("mousemove", move);
	window.addEventListener("touchmove", move, { passive: false });
	window.addEventListener("mouseup", stop);
	window.addEventListener("touchend", stop);
}
const addSectionButton = document.getElementById("addSection");
if (addSectionButton) {
	addSectionButton.onclick = () => addSection();
}

setupThemeToggle();
setupMobileHeaderCollapse();
setupCollapsible();
setupSidebarCollapse();
setupResizablePanels();

save();
render();
