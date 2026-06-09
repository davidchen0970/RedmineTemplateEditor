import { envKeys, presets, esc, block, impl, sec, uid } from "./state.js";
import {
	ensureBlockContents,
	textile,
	textileToPreviewHtml,
} from "./textile.js";

export function label(t) {
	return (
		{
			implementation: "Implementation Unit",
			text: "Text / Textile",
			command: "Command Block",
			diff: "Diff Block",
			log: "Log Block",
			mermaid: "Mermaid Block",
			image: "Image",
			collapse: "Collapse",
		}[t] || t
	);
}

export function createRenderer(ctx) {
	const {
		getState,
		getView,
		getExportStatus,
		getLastSaveText,
		changed,
		onPresetClick,
	} = ctx;
	let pendingAddSectionId = null;

	function ensureUiState() {
		const state = getState();
		state.ui ||= {};
		state.ui.collapsed ||= {};
		state.ui.collapsed.sections ||= {};
		state.ui.collapsed.blocks ||= {};
		return state.ui;
	}

	function isCollapsed(scope, id, defaultCollapsed = false) {
		const ui = ensureUiState();
		return ui.collapsed[scope]?.[id] ?? defaultCollapsed;
	}

	function blockTypeOptionsHtml() {
		return [
			["implementation", "Implementation Unit"],
			["text", "Text / Textile"],
			["command", "Command Block"],
			["diff", "Diff Block"],
			["log", "Log Block"],
			["mermaid", "Mermaid Block"],
			["image", "Image"],
			["collapse", "Collapse"],
		]
			.map(([value, text]) => `<option value="${value}">${text}</option>`)
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
		dialog.innerHTML = `
			<form method="dialog" id="addBlockForm">
				<div class="dialog-head">新增區塊</div>
				<div class="dialog-body">
					<div class="field">
						<label>區塊類型</label>
						<select id="addBlockType">${blockTypeOptionsHtml()}</select>
					</div>
					<div class="field">
						<label>區塊標題</label>
						<input id="addBlockTitle" type="text">
					</div>
				</div>
				<div class="dialog-actions">
					<button type="button" id="addBlockCancel">取消</button>
					<button type="submit" class="primary">新增</button>
				</div>
			</form>`;
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

	function findSec(id) {
		return getState().sections.find((s) => s.id === id);
	}

	function render() {
		renderPresets();
		renderFields();
		renderToggles();
		renderSections();
		renderOut();
		renderSaveStatus();
	}

	function renderSaveStatus() {
		const el = document.getElementById("save");
		const exportStatus = getExportStatus();
		if (el)
			el.textContent = `${getLastSaveText() || "已自動儲存 --"} · JSON ${exportStatus.json ? "已匯出" : "未匯出"} · TXT ${exportStatus.txt ? "已匯出" : "未匯出"}`;
	}

	function bind(id, val, set) {
		const el = document.getElementById(id);
		if (!el) return;
		if (document.activeElement !== el) el.value = val || "";
		el.oninput = () => {
			set(el.value);
			changed();
		};
		el.onchange = el.oninput;
	}

	function renderPresets() {
		const state = getState();
		const r = document.getElementById("templates");
		r.innerHTML = "";
		Object.entries(presets).forEach(([k, p]) => {
			const d = document.createElement("div");
			d.className = "card " + (state.noteType === k ? "active" : "");
			d.innerHTML = `<strong>${esc(p.label)}</strong><span>${esc(p.desc)}</span>`;
			d.onclick = () => onPresetClick(k);
			r.appendChild(d);
		});
	}

	function renderFields() {
		const state = getState();
		bind("title", state.title, (v) => (state.title = v));
		bind("status", state.status, (v) => (state.status = v));
		bind("summary", state.summary, (v) => (state.summary = v));
		bind("change", state.changeContent, (v) => (state.changeContent = v));
		bind("ref", state.relatedRef, (v) => (state.relatedRef = v));
		const e = document.getElementById("env");
		e.innerHTML = "";
		envKeys.forEach(([k, l]) => {
			const d = document.createElement("label");
			d.className = "field";
			d.innerHTML = `${esc(l)}<textarea data-env="${k}">${esc(state.environment[k] || "")}</textarea>`;
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
		const state = getState();
		const r = document.getElementById("toggles");
		r.innerHTML = "";
		state.sections.forEach((s) => {
			const d = document.createElement("label");
			d.className = "note";
			d.innerHTML = `<input type="checkbox" data-t="${s.id}" ${s.enabled ? "checked" : ""}> ${esc(s.title)}`;
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

	function renderSections() {
		const state = getState();
		const r = document.getElementById("sections");
		r.innerHTML = "";
		state.sections.forEach((s) => {
			const d = document.createElement("div");
			d.className = "section";
			const collapsed = isCollapsed("sections", s.id, true);
			d.innerHTML = `
				<div class="section-head">
					<label>
						<input type="checkbox" data-se="${s.id}" ${s.enabled ? "checked" : ""}>
					</label>
					<button 
						class="section-title-btn" 
						data-collapse-target="section-body-${s.id}" 
						data-collapse-scope="sections" 
						data-collapse-key="${s.id}" 
						aria-expanded="${String(!collapsed)}">${esc(s.title)}</button>
					<div class="actions">
						<button class="small" data-up="${s.id}">上移</button>
						<button class="small" data-down="${s.id}">下移</button>
						<button class="small" data-add="${s.id}">新增區塊</button>
						<button class="small" data-dup-section="${s.id}">複製段落</button>
						<button class="small danger" data-del-section="${s.id}">刪除</button>
					</div>
				</div>
				<div class="section-body ${collapsed ? "collapsed" : ""}" id="section-body-${s.id}">
					<label class="field">段落標題 h3.
						<input data-st="${s.id}" value="${esc(s.title)}">
					</label>
					<label class="field">段落說明
						<textarea data-sdesc="${s.id}">${esc(s.description || "")}</textarea>
					</label>
					<div data-bs="${s.id}"></div>
				</div>`;
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
		r.querySelectorAll("[data-dup-section]").forEach(
			(x) => (x.onclick = () => duplicateSection(x.dataset.dupSection))
		);
		r.querySelectorAll("[data-del-section]").forEach(
			(x) => (x.onclick = () => deleteSection(x.dataset.delSection)),
		);
	}

	function renderBlock(sid, b) {
		ensureBlockContents(b);
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
					`<option value="${t}" ${b.type === t ? "selected" : ""}>${label(t)}</option>`,
			)
			.join("");
		d.innerHTML = `<div class="actions" style="justify-content:space-between"><span class="note">${label(b.type)}</span><span><button class="small" data-bup>上移</button><button class="small" data-bdown>下移</button><button class="small" data-du>複製</button><button class="small danger" data-del>刪除</button></span></div><div class="grid-2"><label class="field">區塊類型<select data-btype>${options}</select></label><label class="field">區塊標題<input data-btitle value="${esc(b.title || "")}"></label></div>${b.type === "implementation" ? `<div class="grid-2"><label class="field"><input type="checkbox" data-show-work ${b.showWorkPath !== false ? "checked" : ""}> 輸出 work path<input data-work-title value="${esc(b.workPathTitle || "work path")}"><textarea data-work>${esc(b.workPath || "(docker)$ pwd")}</textarea></label><label class="field">主要內容語言 class<input data-lang value="${esc(b.codeLang || "cpp")}"></label></div><label class="field">Description<textarea data-desc>${esc(b.description || "")}</textarea></label>` : ""}<div data-contents></div><button class="small primary" data-add-content>新增 content</button>`;
		const cr = d.querySelector("[data-contents]");
		b.contents.forEach((c, i) => {
			const item = document.createElement("div");
			item.className = "block";
			item.innerHTML = `<div class="actions" style="justify-content:space-between"><span class="note">content #${i + 1}</span><span><button class="small" data-dup-content="${i}">複製</button><button class="small danger" data-del-content="${i}">刪除</button></span></div><label class="field">內容<textarea data-cont-index="${i}" style="min-height:${b.type === "implementation" ? 170 : 120}px">${esc(c)}</textarea></label>`;
			cr.appendChild(item);
		});
		d.querySelector("[data-btype]").onchange = (e) => {
			b.type = e.target.value;
			if (b.type === "implementation") {
				b.title = b.title || "api.c";
				b.workPath = b.workPath || "(docker)$ pwd";
				b.workPathTitle = b.workPathTitle || "work path";
				b.codeLang = b.codeLang || "cpp";
			}
			changed();
			render();
		};
		d.querySelector("[data-btitle]").oninput = (e) => {
			b.title = e.target.value;
			changed();
		};
		d.querySelectorAll("[data-cont-index]").forEach(
			(x) =>
			(x.oninput = (e) => {
				b.contents[Number(x.dataset.contIndex)] = e.target.value;
				ensureBlockContents(b);
				changed();
			}),
		);
		d.querySelectorAll("[data-del-content]").forEach(
			(x) =>
			(x.onclick = () => {
				b.contents.length <= 1
					? (b.contents[0] = "")
					: b.contents.splice(Number(x.dataset.delContent), 1);
				ensureBlockContents(b);
				changed();
				render();
			}),
		);
		d.querySelectorAll("[data-dup-content]").forEach(
			(x) =>
			(x.onclick = () => {
				const i = Number(x.dataset.dupContent);
				b.contents.splice(i + 1, 0, b.contents[i] || "");
				ensureBlockContents(b);
				changed();
				render();
			}),
		);
		d.querySelector("[data-add-content]").onclick = () => {
			b.contents.push("");
			changed();
			render();
		};
		["work", "work-title", "lang", "desc"].forEach((name) => {
			const el = d.querySelector(`[data-${name}]`);
			if (el)
				el.oninput = (e) => {
					({
						work: "workPath",
						"work-title": "workPathTitle",
						lang: "codeLang",
						desc: "description",
					})[name] &&
						(b[
							{
								work: "workPath",
								"work-title": "workPathTitle",
								lang: "codeLang",
								desc: "description",
							}[name]
						] = e.target.value);
					changed();
				};
		});
		const sw = d.querySelector("[data-show-work]");
		if (sw)
			sw.onchange = (e) => {
				b.showWorkPath = e.target.checked;
				changed();
			};
		d.querySelector("[data-bup]").onclick = () => moveBlock(sid, b.id, -1);
		d.querySelector("[data-bdown]").onclick = () => moveBlock(sid, b.id, 1);
		d.querySelector("[data-del]").onclick = () => {
			findSec(sid).blocks = findSec(sid).blocks.filter((x) => x.id !== b.id);
			changed();
			render();
		};
		d.querySelector("[data-du]").onclick = () => {
			const nb = JSON.parse(JSON.stringify(b));
			nb.id = uid();
			if (getState().ui?.collapsed?.blocks)
				delete getState().ui.collapsed.blocks[nb.id];
			nb.title = (nb.title || "") + " copy";
			findSec(sid).blocks.push(nb);
			changed();
			render();
		};
		return d;
	}

	function addSection(title = "新增段落") {
		getState().sections.push(sec(prompt("段落標題 h3.", title) || title, true));
		changed();
		render();
	}

	function duplicateSection(id) {
		const state = getState();
		const target = findSec(id);
		if (!target) return;

		const copied = JSON.parse(JSON.stringify(target));
		copied.id = uid();
		copied.title = (copied.title || "段落") + " copy";
		copied.blocks = (copied.blocks || []).map((b) => ({
			...b,
			id: uid(),
		}));

		const index = state.sections.filter((s) => s.id === id);
		state.sections.splice(index + 1, 0, copied);
		changed();
		render();
	}
	function deleteSection(id) {
		const state = getState();
		const s = findSec(id);
		if (s && confirm(`刪除段落「${s.title}」？`)) {
			state.sections = state.sections.filter((x) => x.id !== id);
			if (state.ui?.collapsed?.sections) delete state.ui.collapsed.sections[id];
			changed();
			render();
		}
	}

	function moveSec(id, dir) {
		const state = getState();
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

	function moveBlock(sid, bid, dir) {
		const s = findSec(sid),
			i = s.blocks.findIndex((b) => b.id === bid),
			j = i + dir;
		if (i < 0 || j < 0 || j >= s.blocks.length) return;
		[s.blocks[i], s.blocks[j]] = [s.blocks[j], s.blocks[i]];
		changed();
		render();
	}

	function addBlock(id) {
		if (typeof HTMLDialogElement === "undefined") {
			const t =
				prompt(
					"區塊類型：implementation / text / command / diff / log / mermaid / image / collapse",
					"implementation",
				) || "text";
			const title = prompt("區塊標題", defaultBlockTitle(t)) || "";
			findSec(id).blocks.push(
				t === "implementation"
					? impl(title || "api.c")
					: block(t, title || label(t), ""),
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

	function renderOut() {
		const state = getState();
		const view = getView();
		const raw = textile(state),
			out = document.getElementById("out"),
			preview = document.getElementById("preview");
		out.value = view === "json" ? JSON.stringify(state, null, 2) : raw;
		out.classList.toggle("hidden", view === "preview");
		preview.classList.toggle("hidden", view !== "preview");
		if (view === "preview") {
			preview.innerHTML = textileToPreviewHtml(raw);

			if (window.mermaid) {
				window.mermaid
					.run({
						querySelector: ".mermaid",
					})
					.catch((err) => {
						console.warn("Mermaid render failed:", err);
					});
			}
		}
		document
			.querySelectorAll(".segmented button")
			.forEach((b) => b.classList.remove("active"));
		({ raw: "raw", preview: "previewbtn", json: "statebtn" })[view] &&
			document
				.getElementById(
					{ raw: "raw", preview: "previewbtn", json: "statebtn" }[view],
				)
				.classList.add("active");
		const stats = document.getElementById("stats");
		if (stats)
			stats.textContent = `${raw.length} 字元 · ${raw.split("\n").length} 行`;
	}

	function toast(msg) {
		const t = document.getElementById("toast");
		t.textContent = msg;
		t.classList.add("show");
		setTimeout(() => t.classList.remove("show"), 1800);
	}

	function addVerificationSnippet(type) {
		const state = getState();
		let s =
			state.sections.find((x) => x.title === "結果驗證") ||
			sec("結果驗證", true);
		if (!state.sections.includes(s)) state.sections.push(s);
		s.enabled = true;
		if (type === "journalctl")
			s.blocks.push(
				block(
					"command",
					"journalctl",
					"root@bmc-host:~# journalctl -o short-precise | grep obmc-console-server\n...",
				),
			);
		if (type === "systemctl")
			s.blocks.push(
				block(
					"command",
					"systemctl",
					"root@bmc-host:~# systemctl status obmc-console@ttyS0.service -l\n...",
				),
			);
		if (type === "i2c")
			s.blocks.push(
				block(
					"command",
					"i2cget/set",
					"root@bmc-host:~# i2cget -y 7 0x71 0xc\n0x00\nroot@bmc-host:~# i2cset -y 7 0x71 0xc 0x2",
				),
			);
		changed();
		render();
	}

	return {
		render,
		renderOut,
		renderSaveStatus,
		renderToggles,
		toast,
		findSec,
		addSection,
		addVerificationSnippet,
	};
}
