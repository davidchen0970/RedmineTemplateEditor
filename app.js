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
) {
	return {
	id: uid(),
	type: "implementation",
	title,
	workPath,
	codeLang: lang,
	description,
	content,
	};
}
function sec(title, enabled, blocks = []) {
	return { id: uid(), title, enabled, blocks };
}
const presets = {
	hardware: {
	label: "Hardware Check",
	desc: "Schematic / 線路檢查",
	title: "檢查 SOL 在 schematic 的電路",
	status: "PASS",
	summary: "檢查後確認 BMC <-UART1-> CPLD <--> console\nSYS_UART 線路已補上",
	change: "X",
	sections: [
		sec("Block Diagram", true, [
		block(
			"text",
			"說明",
			"底下分三部份檢視\n## SYS_UART 線路\n## SOL_UART 線路\n## CPLD <-> RJ45 線路",
		),
		]),
		sec("Schematic", true, [
		block(
			"mermaid",
			"SYS_UART 線路",
			"flowchart LR\n	x86[Intel x86] <--> SYS_UART\n	SYS_UART <--> CPLD[CPLD]",
		),
		]),
		sec("實作流程", false, [impl()]),
		sec("結果驗證", false, []),
		sec("參考資料", true, [block("text", "Reference", '# "":')]),
	],
	},
	porting: {
	label: "Porting",
	desc: "功能移植 / 設定修改",
	title: "Porting SOL function",
	status: "PASS",
	summary: "在手動調整 UART route 後即可成功使用 SOL",
	change: "Add obmc-console in @meta-platform@",
	sections: [
		sec("系統架構", true, [
		block(
			"mermaid",
			"obmc-console workflow",
			"flowchart LR\n	client[obmc-console-client] <--> socket[Unix socket]\n	socket <--> server[obmc-console-server]",
		),
		]),
		sec("實作流程", true, [impl("api.c", "(docker)$ pwd", "cpp", "")]),
		sec("結果驗證", true, [
		block(
			"command",
			"service status",
			"root@bmc-host:~# systemctl status obmc-console@ttyS0.service -l",
		),
		]),
		sec("備註", true, [
		block(
			"text",
			"UART route",
			"0x71 0xc = 0 (x86 mode)\n0x71 0xc = 1 (BMC mode)\n0x71 0xc = 2 (SOL mode)",
		),
		]),
		sec("參考資料", true, [
		block(
			"text",
			"Reference",
			'# "Platform Porting Guide.pdf":https://example.invalid/...',
		),
		]),
	],
	},
	debug: {
	label: "Debug",
	desc: "問題排查 / FAILED note",
	title: "在 obmc-console 當中加上 debug code 計算 client 個數",
	status: "FAILED",
	summary:
		"有 @Open /tmp/biosDbg0.log to write@ 的 err msg\n一開始有 @bus_error_message@ 的問題產生",
	change: "obmc-console (socket-handler.c) - 增加 n_clients 的 debug info",
	sections: [
		sec("實作流程", true, [
		impl(
			"socket-handler.c",
			"(docker)$ devtool modify obmc-console",
			"cpp",
			'warn("%d = sh->n_clients", sh->n_clients);',
		),
		]),
		sec("結果驗證", true, [
		block(
			"log",
			"測試 1：不同瀏覽器使用 WebUI SOL",
			"root@bmc-host:~# journalctl -o short-precise | grep obmc-console-server\n...",
		),
		]),
		sec("參考資料", true, [block("text", "Reference", '# "":')]),
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
	document.getElementById("save").textContent =
	"已自動儲存 " + new Date().toLocaleTimeString();
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
		'</label><input type="text" data-env="' +
		k +
		'" value="' +
		esc(state.environment[k] || "") +
		'">';
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
	'"><button class="small" data-up="' +
	s.id +
	'">上移</button><button class="small" data-down="' +
	s.id +
	'">下移</button><button class="small" data-add="' +
	s.id +
	'">新增區塊</button></div>'
	);
}
function renderSections() {
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
		'" aria-expanded="true"><strong>' +
		esc(s.title) +
		'</strong></button>' +
		sectionActionsHtml(s, "top") +
		'</div><div class="section-body" id="section-body-' +
		s.id +
		'"><div class="field"><label>段落標題 h3.</label><input type="text" data-st="' +
		s.id +
		'" value="' +
		esc(s.title) +
		'"></div><div data-bs="' +
		s.id +
		'"></div>' +
		sectionActionsHtml(s, "bottom") +
		'</div>';
	r.appendChild(d);
	const br = d.querySelector("[data-bs]");
	s.blocks.forEach((b) => br.appendChild(renderBlock(s.id, b)));
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
	r.querySelectorAll("[data-add]").forEach(
	(x) => (x.onclick = () => addBlock(x.dataset.add)),
	);
	r.querySelectorAll("[data-up]").forEach(
	(x) => (x.onclick = () => moveSec(x.dataset.up, -1)),
	);
	r.querySelectorAll("[data-down]").forEach(
	(x) => (x.onclick = () => moveSec(x.dataset.down, 1)),
	);
}
function renderBlock(sid, b) {
	const d = document.createElement("div");
	d.className = "block";
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
	if (b.type === "implementation") {
	d.innerHTML =
		'<div class="actions" style="justify-content:space-between"><span class="note">Implementation Unit</span><span><button class="small" data-du="' +
		b.id +
		'">複製</button> <button class="small danger" data-del="' +
		b.id +
		'">刪除</button></span></div><div class="row"><div class="field"><label>區塊類型</label><select data-btype="' +
		b.id +
		'">' +
		options +
		'</select></div><div class="field"><label>檔名 / 單位標題，輸出為 # xxx</label><input type="text" data-btitle="' +
		b.id +
		'" value="' +
		esc(b.title || "api.c") +
		'"></div></div><div class="row"><div class="field"><label>work path，輸出到 collapse(work path)</label><textarea data-work="' +
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
		'</textarea></div><div class="field"><label>主要內容，輸出到 &lt;pre&gt;&lt;code class="..."&gt;</label><textarea style="min-height:170px" data-cont="' +
		b.id +
		'">' +
		esc(b.content || "") +
		"</textarea></div>";
	} else {
	d.innerHTML =
		'<div class="actions" style="justify-content:space-between"><span class="note">' +
		label(b.type) +
		'</span><span><button class="small" data-du="' +
		b.id +
		'">複製</button> <button class="small danger" data-del="' +
		b.id +
		'">刪除</button></span></div><div class="row"><div class="field"><label>區塊類型</label><select data-btype="' +
		b.id +
		'">' +
		options +
		'</select></div><div class="field"><label>區塊標題</label><input type="text" data-btitle="' +
		b.id +
		'" value="' +
		esc(b.title || "") +
		'"></div></div><div class="field"><label>內容</label><textarea style="min-height:130px" data-cont="' +
		b.id +
		'">' +
		esc(b.content || "") +
		"</textarea></div>";
	}
	d.querySelector("[data-btype]").onchange = (e) => {
	b.type = e.target.value;
	if (b.type === "implementation") {
		b.workPath = b.workPath || "(docker)$ pwd";
		b.codeLang = b.codeLang || "cpp";
		b.description = b.description || "";
		b.title = b.title || "api.c";
	}
	changed();
	render();
	};
	d.querySelector("[data-btitle]").oninput = (e) => {
	b.title = e.target.value;
	changed();
	renderOut();
	};
	const c = d.querySelector("[data-cont]");
	if (c)
	c.oninput = (e) => {
		b.content = e.target.value;
		changed();
		renderOut();
	};
	const w = d.querySelector("[data-work]");
	if (w)
	w.oninput = (e) => {
		b.workPath = e.target.value;
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
	addH3(o, "結論");
	o.push("執行狀態: " + status(state.status));
	lines(state.summary).forEach((x) => o.push("* " + x));
	o.push("");
	addH3(o, "修改目標");
	o.push("修改內容: " + (state.changeContent || ""));
	o.push("");
	addH3(o, "測試環境");
	envKeys.forEach(([k, l]) => {
	const v = state.environment[k];
	if (v) o.push("* " + l + ": " + v);
	});
	o.push("");
	state.sections
	.filter((s) => s.enabled)
	.forEach((s) => {
		addH3(o, s.title);
		s.blocks.forEach((b) => push(o, b));
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
	if (b.type === "implementation") {
	o.push("# " + (title || "api.c"));
	o.push("{{collapse(work path)");
	o.push('<pre><code class="shell">');
	o.push(b.workPath || "(docker)$ pwd");
	o.push("</code></pre>");
	o.push("}}");
	if ((b.description || "").trim()) {
		o.push(b.description || "");
	}
	o.push(
		'<pre><code class="' +
		(b.codeLang || "cpp") +
		'">' +
		(b.content || "") +
		"</code></pre>",
	);
	return;
	}
	if (title && b.type !== "image") o.push("*" + title + "*");
	if (["command", "diff", "log"].includes(b.type)) {
	o.push("{{collapse(" + (title || "detail") + ")");
	o.push("```");
	o.push(b.content || "");
	o.push("```");
	o.push("}}");
	} else if (b.type === "mermaid") {
	o.push("{{mermaid");
	o.push(b.content || "");
	o.push("}}");
	} else if (b.type === "image") {
	lines(b.content).forEach((x) =>
		o.push("!" + x.replace(/^!|!$/g, "") + "!"),
	);
	} else if (b.type === "collapse") {
	o.push("{{collapse(" + (title || "detail") + ")");
	o.push(b.content || "");
	o.push("}}");
	} else {
	o.push(b.content || "");
	}
}
function renderOut() {
	document.getElementById("out").value =
	view === "json" ? JSON.stringify(state, null, 2) : textile();
}
document.getElementById("raw").onclick = () => {
	view = "raw";
	renderOut();
};
document.getElementById("statebtn").onclick = () => {
	view = "json";
	renderOut();
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
document.getElementById("txt").onclick = () =>
	download(safe(state.title) + ".txt", textile(), "text/plain");
document.getElementById("json").onclick = () =>
	download(
	safe(state.title) + ".json",
	JSON.stringify(state, null, 2),
	"application/json",
	);
document.getElementById("import").onclick = () =>
	document.getElementById("file").click();
document.getElementById("file").onchange = (e) => {
	const f = e.target.files[0];
	if (!f) return;
	const r = new FileReader();
	r.onload = () => {
	try {
		const obj = JSON.parse(r.result);
		if (!obj.sections || !obj.environment) throw new Error("格式不符合");
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

function setupCollapsible() {
	document.addEventListener("click", (e) => {
	const toggle = e.target.closest("[data-collapse-target]");
	if (!toggle) return;

	const target = document.getElementById(toggle.dataset.collapseTarget);
	if (!target) return;

	const expanded = toggle.getAttribute("aria-expanded") !== "false";
	toggle.setAttribute("aria-expanded", String(!expanded));
	target.classList.toggle("collapsed", expanded);
	});
}
function setupSidebarCollapse() {
	const layout = document.getElementById("appLayout");
	const btn = document.getElementById("sidebarCollapse");
	if (!layout || !btn) return;
	const saved = localStorage.getItem(KEY + ":sidebarCollapsed") === "1";
	layout.classList.toggle("sidebar-collapsed", saved);
	btn.textContent = saved ? "☰" : "‹";
	btn.title = saved ? "展開模板與段落" : "收合模板與段落";
	btn.onclick = () => {
	const collapsed = !layout.classList.contains("sidebar-collapsed");
	layout.classList.toggle("sidebar-collapsed", collapsed);
	localStorage.setItem(KEY + ":sidebarCollapsed", collapsed ? "1" : "0");
	btn.textContent = collapsed ? "☰" : "‹";
	btn.title = collapsed ? "展開模板與段落" : "收合模板與段落";
	};
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
setupCollapsible();
setupSidebarCollapse();
setupResizablePanels();

save();
render();
