import { envKeys, presets, esc, block, impl, sec, uid } from "./state.js";
import {
	ensureBlockContents,
	textile,
	textileToPreviewHtml,
	renderInlineTextile,
} from "./textile.js";

export function label(t) {
	return (
		{
			implementation: "Implementation Unit",
			text: "Text / Textile",
			plainText: "純文字（無標題）",
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
			["plainText", "純文字（無標題）"],
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
		if (type === "implementation") return "api.c";
		if (type === "plainText") return "";
		return label(type);
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

	function normalizeBlockLevel(value, maxLevel = Infinity) {
		const raw = Number(value);
		const level = Number.isFinite(raw) ? Math.floor(raw) : 1;
		return Math.max(1, Math.min(level, maxLevel));
	}

	function getMaxBlockLevel(section, blockIndex) {
		if (blockIndex <= 0) return 1;
		const previous = section.blocks[blockIndex - 1];
		return normalizeBlockLevel(previous?.level) + 1;
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
			d.innerHTML =
				"<label>" +
				esc(l) +
				"</label>" +
				(k === "cpldVersion"
					? "<br><label> (ipmitool raw 0x32 0x1a 0xf1 / i2cget -y 7 0x071 0xf1)</label>"
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
			(s.blocks || []).forEach((b, blockIndex) => {
				b.level = normalizeBlockLevel(b.level, getMaxBlockLevel(s, blockIndex));
				br.appendChild(renderBlock(s.id, b, blockIndex));
			});
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
			(x) => (x.onclick = () => duplicateSection(x.dataset.dupSection)),
		);
		r.querySelectorAll("[data-del-section]").forEach(
			(x) => (x.onclick = () => deleteSection(x.dataset.delSection)),
		);
	}
	function applyDefaultBlockValues(b) {
		if (b.type === "implementation") {
			b.title ||= "api.c";
			b.workPath ||= "(docker)$ pwd";
			b.workPathTitle ||= "work path";
			b.codeLang ||= "cpp";
		}
	}

	function buildOptions(b) {
		return [
			"implementation",
			"text",
			"plainText",
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
	}

	function renderActions(b) {
		return `
		<div class="actions" style="justify-content:space-between">
			<span class="note">${label(b.type)}</span>
			<span>
				<button class="small" data-bup>上移</button>
				<button class="small" data-bdown>下移</button>
				<button class="small" data-du>複製</button>
				<button class="small danger" data-del>刪除</button>
			</span>
		</div>
	`;
	}

	function renderBase(b, options, maxLevel) {
		return `
		<div class="grid-2">
			<label class="field">
				區塊類型
				<select data-btype>${options}</select>
			</label>

			<label class="field block-level-field">
				所在層級
				<input data-blevel type="number" min="1" max="${maxLevel}"
					step="1" value="${b.level || 1}">
			</label>
		</div>

		<label class="field">
			區塊標題
			<input data-btitle value="${esc(b.title || "")}">
		</label>
	`;
	}

	function renderImplementation(b) {
		if (b.type !== "implementation") return "";

		return `
		<div class="grid-2">
			<label class="field">
				<div class="field-header">
					<span>輸出 work path</span>
					<input id="workPath" type="checkbox" data-show-work ${b.showWorkPath !== false ? "checked" : ""}>
				</div>
				<input data-work-title value="${esc(b.workPathTitle || "work path")}">
				<textarea data-work>${esc(b.workPath || "(docker)$ pwd")}</textarea>
			</label>

			<label class="field">
				主要內容語言 class
				<input data-lang value="${esc(b.codeLang || "cpp")}">
			</label>
		</div>

		<label class="field">
			Description
			<textarea data-desc>${esc(b.description || "")}</textarea>
		</label>
	`;
	}

	function renderFooter() {
		return `
		<div data-contents></div>
		<button class="small primary" data-add-content>新增 content</button>
	`;
	}

	function createBlockDOM(b, maxLevel) {
		const d = document.createElement("div");
		d.className = "block";

		const options = buildOptions(b);

		d.innerHTML = `
		${renderActions(b)}
		${renderBase(b, options, maxLevel)}
		${renderImplementation(b)}
		${renderFooter()}
	`;

		return d;
	}

	function renderContents(d, b) {
		const cr = d.querySelector("[data-contents]");
		cr.innerHTML = "";

		b.contents.forEach((c, i) => {
			const item = document.createElement("div");
			item.className = "block";

			item.innerHTML = `
			<div class="actions" style="justify-content:space-between">
				<span class="note">content #${i + 1}</span>
				<span>
					<button class="small" data-dup-content="${i}">複製</button>
					<button class="small danger" data-del-content="${i}">刪除</button>
				</span>
			</div>

			<label class="field">
				內容
				<textarea data-cont-index="${i}"
					style="min-height:${b.type === "implementation" ? 170 : 120}px">${esc(c)}</textarea>
			</label>
		`;

			cr.appendChild(item);
		});
	}

	function duplicateBlock(sid, b) {
		const section = findSec(sid);
		const idx = section.blocks.findIndex((x) => x.id === b.id);

		const nb = JSON.parse(JSON.stringify(b));
		nb.id = uid();

		if (getState().ui?.collapsed?.blocks) {
			delete getState().ui.collapsed.blocks[nb.id];
		}

		if (nb.type !== "plainText") {
			nb.title = (nb.title || "") + " copy";
		}

		section.blocks.splice(idx + 1, 0, nb);

		changed();
		render();
	}

	function bindBlockEvents(d, sid, b, maxLevel) {
		d.querySelector("[data-btype]").onchange = (e) => {
			b.type = e.target.value;
			applyDefaultBlockValues(b);
			changed();
			render();
		};

		d.querySelector("[data-btitle]").oninput = (e) => {
			b.title = e.target.value;
			changed();
		};

		d.querySelector("[data-blevel]").oninput = (e) => {
			b.level = normalizeBlockLevel(e.target.value, maxLevel);
			e.target.value = b.level;
			changed();
			render();
		};

		d.querySelector("[data-bup]").onclick = () => moveBlock(sid, b.id, -1);
		d.querySelector("[data-bdown]").onclick = () => moveBlock(sid, b.id, 1);

		d.querySelector("[data-del]").onclick = () => {
			findSec(sid).blocks = findSec(sid).blocks.filter((x) => x.id !== b.id);
			changed();
			render();
		};

		d.querySelector("[data-du]").onclick = () => duplicateBlock(sid, b);

		d.querySelector("[data-add-content]").onclick = () => {
			b.contents.push("");
			changed();
			render();
		};

		const sw = d.querySelector("[data-show-work]");
		if (sw) {
			sw.onchange = (e) => {
				b.showWorkPath = e.target.checked;
				changed();
			};
		}

		d.querySelectorAll("[data-cont-index]").forEach((x) => {
			x.oninput = (e) => {
				b.contents[Number(x.dataset.contIndex)] = e.target.value;
				ensureBlockContents(b);
				changed();
			};
		});

		d.querySelectorAll("[data-del-content]").forEach((x) => {
			x.onclick = () => {
				const i = Number(x.dataset.delContent);
				b.contents.length <= 1 ? (b.contents[0] = "") : b.contents.splice(i, 1);
				ensureBlockContents(b);
				changed();
				render();
			};
		});

		d.querySelectorAll("[data-dup-content]").forEach((x) => {
			x.onclick = () => {
				const i = Number(x.dataset.dupContent);
				b.contents.splice(i + 1, 0, b.contents[i] || "");
				ensureBlockContents(b);
				changed();
				render();
			};
		});

		["work", "work-title", "lang", "desc"].forEach((name) => {
			const el = d.querySelector(`[data-${name}]`);
			if (!el) return;

			el.oninput = (e) => {
				const map = {
					work: "workPath",
					"work-title": "workPathTitle",
					lang: "codeLang",
					desc: "description",
				};

				b[map[name]] = e.target.value;
				changed();
			};
		});
	}

	function renderBlock(sid, b, blockIndex = 0) {
		ensureBlockContents(b);

		const section = findSec(sid);
		const maxLevel = getMaxBlockLevel(section, blockIndex);

		b.level = normalizeBlockLevel(b.level, maxLevel);
		applyDefaultBlockValues(b);

		const d = createBlockDOM(b, maxLevel);
		renderContents(d, b);
		bindBlockEvents(d, sid, b, maxLevel);

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

		const index = state.sections.findIndex((s) => s.id === id);
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
					"區塊類型：implementation / text / plainText / command / diff / log / mermaid / image / collapse",
					"implementation",
				) || "text";
			const title = prompt("區塊標題", defaultBlockTitle(t)) || "";
			findSec(id).blocks.push(
				t === "implementation"
					? impl(title || "api.c")
					: block(t, title || defaultBlockTitle(t), ""),
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

	function hasPreviewText(value) {
		return String(value ?? "").trim().length > 0;
	}

	function previewBlockLevel(b) {
		const raw = Number(b?.level || 1);
		return Math.max(1, Number.isFinite(raw) ? Math.floor(raw) : 1);
	}

	function previewDisplayHtml(value, mode = "inline") {
		const text = String(value ?? "");
		return mode === "code" ? esc(text) : renderInlineTextile(text);
	}

	function previewTargetAttrs(
		path,
		value,
		editor = "textarea",
		mode = "inline",
	) {
		return `tabindex="0" data-preview-edit="${esc(path)}" data-preview-editor="${editor}" data-preview-mode="${mode}" data-preview-value="${esc(value || "")}"`;
	}

	function previewTargetTag(
		tag,
		path,
		value,
		className = "",
		editor = "textarea",
		mode = "inline",
	) {
		if (!hasPreviewText(value)) return "";
		const cls = `preview-edit-target${className ? " " + className : ""}`;
		return `<${tag} class="${cls}" ${previewTargetAttrs(path, value, editor, mode)}>${previewDisplayHtml(value, mode)}</${tag}>`;
	}

	function statusTextile(value) {
		if (value === "PASS") return "%{color:green}PASS%";
		if (value === "FAILED") return "%{color:red}FAILED%";
		if (value === "WIP") return "%{color:orange}WIP%";
		return "N/A";
	}

	function renderStatusPreview(value) {
		return `<span class="preview-status-display preview-edit-target" tabindex="0" data-preview-status="true" data-preview-value="${esc(value || "N/A")}">${renderInlineTextile(statusTextile(value))}</span>`;
	}

	function renderEditablePreview(state) {
		const html = [];
		html.push(`<div class="editable-preview-note">`);
		html.push(
			previewTargetTag(
				"h2",
				"top:title",
				state.title,
				"preview-edit-heading",
				"input",
			),
		);

		if (hasPreviewText(state.relatedRef)) {
			html.push(
				previewTargetTag(
					"div",
					"top:relatedRef",
					state.relatedRef,
					"preview-edit-text",
					"textarea",
				),
			);
		}

		if (state.status !== "N/A" || hasPreviewText(state.summary)) {
			html.push(`<h3>結論</h3>`);
			if (state.status !== "N/A")
				html.push(`<p>執行狀態: ${renderStatusPreview(state.status)}</p>`);
			const summaryLines = String(state.summary || "")
				.split("\n")
				.filter((x) => x.trim());
			if (summaryLines.length) {
				html.push("<ul>");
				summaryLines.forEach((line, index) => {
					html.push(
						`<li class="preview-edit-target" ${previewTargetAttrs("summary:" + index, line, "input")}>${previewDisplayHtml(line)}</li>`,
					);
				});
				html.push("</ul>");
			}
		}

		if (hasPreviewText(state.changeContent)) {
			html.push(`<h3>修改目標</h3>`);
			html.push(
				`<div class="preview-field-row"><span>修改內容:</span>${previewTargetTag("div", "top:changeContent", state.changeContent, "preview-edit-text", "textarea")}</div>`,
			);
		}

		const envRows = envKeys
			.map(([key, label]) => [key, label, state.environment?.[key] || ""])
			.filter(([, , value]) => hasPreviewText(value));
		if (envRows.length) {
			html.push(`<h3>測試環境</h3><ul>`);
			envRows.forEach(([key, label, value]) => {
				html.push(
					`<li><strong>${esc(label)}:</strong> ${previewTargetTag("span", "env:" + key, value, "preview-edit-inline", "textarea")}</li>`,
				);
			});
			html.push(`</ul>`);
		}

		(state.sections || [])
			.filter((section) => section.enabled)
			.forEach((section) => {
				const sectionTitle = previewTargetTag(
					"h3",
					`section:${section.id}:title`,
					section.title,
					"preview-edit-heading",
					"input",
				);
				if (sectionTitle) html.push(sectionTitle);
				const sectionDesc = previewTargetTag(
					"div",
					`section:${section.id}:description`,
					section.description,
					"preview-edit-text",
					"textarea",
				);
				if (sectionDesc) html.push(sectionDesc);

				(section.blocks || []).forEach((b) => {
					ensureBlockContents(b);
					const blockParts = [];
					if (b.type !== "plainText" && b.type !== "image") {
						const title = previewTargetTag(
							"div",
							`block:${section.id}:${b.id}:title`,
							b.title,
							"preview-edit-block-title",
							"input",
						);
						if (title) blockParts.push(title);
					}

					if (b.type === "implementation") {
						if (b.showWorkPath !== false && hasPreviewText(b.workPath)) {
							const summary = hasPreviewText(b.workPathTitle)
								? previewTargetTag(
										"span",
										`block:${section.id}:${b.id}:workPathTitle`,
										b.workPathTitle,
										"preview-edit-inline",
										"input",
									)
								: esc("work path");
							blockParts.push(
								`<details><summary>${summary}</summary>${previewTargetTag(
									"pre",
									`block:${section.id}:${b.id}:workPath`,
									b.workPath,
									"preview-edit-code",
									"textarea",
									"code",
								)}</details>`,
							);
						}
						const desc = previewTargetTag(
							"div",
							`block:${section.id}:${b.id}:description`,
							b.description,
							"preview-edit-text",
							"textarea",
						);
						if (desc) blockParts.push(desc);
					}

					(b.contents || []).forEach((content, index) => {
						if (!hasPreviewText(content)) return;
						const path = `block:${section.id}:${b.id}:content:${index}`;
						if (
							["command", "diff", "log", "implementation", "mermaid"].includes(
								b.type,
							)
						) {
							blockParts.push(
								previewTargetTag(
									"pre",
									path,
									content,
									"preview-edit-code",
									"textarea",
									"code",
								),
							);
						} else if (b.type === "image") {
							blockParts.push(
								`<div class="preview-placeholder">Image: ${previewTargetTag("span", path, content, "preview-edit-inline", "textarea", "code")}</div>`,
							);
						} else {
							blockParts.push(
								previewTargetTag(
									"div",
									path,
									content,
									"preview-edit-text",
									"textarea",
								),
							);
						}
					});

					if (blockParts.length) {
						const level = previewBlockLevel(b);
						const indent = Math.max(0, level - 1) * 22;
						const marker = "#".repeat(level);
						html.push(
							`<div class="preview-edit-block preview-edit-level-${level}" style="margin-left:${indent}px"><span class="preview-hierarchy-marker">${marker}</span><div class="preview-edit-block-content">${blockParts.join("\n")}</div></div>`,
						);
					}
				});
			});

		html.push(`</div>`);
		return (
			html.join("\n") || '<p class="preview-placeholder">尚無可預覽內容</p>'
		);
	}

	function findBlock(sectionId, blockId) {
		const section = findSec(sectionId);
		return section?.blocks?.find((b) => b.id === blockId);
	}

	function applyPreviewEdit(path, value) {
		const state = getState();
		const parts = String(path || "").split(":");
		if (parts[0] === "top") {
			const map = {
				title: "title",
				relatedRef: "relatedRef",
				changeContent: "changeContent",
			};
			if (map[parts[1]]) state[map[parts[1]]] = value;
			return;
		}
		if (parts[0] === "summary") {
			const index = Number(parts[1]);
			const rows = String(state.summary || "")
				.split("\n")
				.filter((x) => x.trim());
			if (Number.isFinite(index)) {
				rows[index] = value;
				state.summary = rows.filter((x) => x.trim()).join("\n");
			}
			return;
		}
		if (parts[0] === "env") {
			state.environment ||= {};
			state.environment[parts[1]] = value;
			return;
		}
		if (parts[0] === "section") {
			const section = findSec(parts[1]);
			if (section && ["title", "description"].includes(parts[2]))
				section[parts[2]] = value;
			return;
		}
		if (parts[0] === "block") {
			const b = findBlock(parts[1], parts[2]);
			if (!b) return;
			const field = parts[3];
			if (
				["title", "workPath", "workPathTitle", "description"].includes(field)
			) {
				b[field] = value;
				return;
			}
			if (field === "content") {
				const index = Number(parts[4] || 0);
				ensureBlockContents(b);
				b.contents[index] = value;
				b.content = b.contents.join("\n");
			}
		}
	}

	function syncFormAfterPreviewEdit() {
		renderFields();
		renderSections();
		renderToggles();
		renderSaveStatus();
	}

	function buildPreviewEditor(target) {
		if (target.dataset.previewStatus === "true") {
			const select = document.createElement("select");
			select.className = "preview-live-editor preview-live-status";
			["PASS", "FAILED", "WIP", "N/A"].forEach((value) => {
				const option = document.createElement("option");
				option.value = value;
				option.textContent = value;
				select.appendChild(option);
			});
			select.value = target.dataset.previewValue || "N/A";
			select.dataset.previewStatusEditor = "true";
			return select;
		}
		const editorType =
			target.dataset.previewEditor === "input" ? "input" : "textarea";
		const editor = document.createElement(editorType);
		editor.className =
			"preview-live-editor" +
			(target.dataset.previewMode === "code" ? " preview-live-code" : "");
		editor.value = target.dataset.previewValue || "";
		editor.dataset.previewEdit = target.dataset.previewEdit;
		if (editorType === "textarea") {
			editor.rows = Math.max(
				2,
				Math.min(16, editor.value.split("\n").length + 1),
			);
		}
		return editor;
	}

	function openPreviewEditor(target) {
		if (!target || target.dataset.previewEditing === "true") return;
		const editor = buildPreviewEditor(target);
		target.dataset.previewEditing = "true";
		target.replaceWith(editor);
		editor.focus();
		if (typeof editor.select === "function") editor.select();

		const commit = () => {
			if (editor.dataset.committed === "true") return;
			editor.dataset.committed = "true";
			renderOut();
		};

		editor.addEventListener("input", () => {
			if (editor.dataset.previewStatusEditor === "true") return;
			applyPreviewEdit(editor.dataset.previewEdit, editor.value);
			changed({ skipRenderOut: true });
			syncFormAfterPreviewEdit();
		});
		editor.addEventListener("change", () => {
			if (editor.dataset.previewStatusEditor === "true") {
				getState().status = editor.value;
				changed({ skipRenderOut: true });
				syncFormAfterPreviewEdit();
			}
		});
		editor.addEventListener("keydown", (event) => {
			if (event.key === "Escape") {
				event.preventDefault();
				commit();
			}
			if (event.key === "Enter" && editor.tagName === "INPUT") {
				event.preventDefault();
				editor.blur();
			}
		});
		editor.addEventListener("blur", commit);
	}

	function bindEditablePreview(preview) {
		preview.onclick = (event) => {
			const target = event.target.closest(".preview-edit-target");
			if (!target || !preview.contains(target)) return;
			openPreviewEditor(target);
		};
		preview.onkeydown = (event) => {
			if (event.key !== "Enter") return;
			const target = event.target.closest(".preview-edit-target");
			if (!target || !preview.contains(target)) return;
			event.preventDefault();
			openPreviewEditor(target);
		};
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
			preview.innerHTML = renderEditablePreview(state);
			bindEditablePreview(preview);

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
