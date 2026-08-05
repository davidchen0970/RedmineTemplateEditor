import {
	KEY,
	makeState,
	loadState,
	saveState,
	safe,
	impl,
	sec,
	normalizeState,
	getActiveDocument,
	getActiveDocumentId,
	setActiveDocumentId,
	ensureDocumentIndex,
	renameDocument,
	createDocument,
	deleteDocument,
} from "./js/state.js";
import { textile } from "./js/textile.js";
import {
	createRenderer,
	setupMobileHeaderCollapse
} from "./js/renderer.js";

let activeDocumentId = getActiveDocumentId(),
	state = normalizeState(loadState(activeDocumentId)) || makeState(),
	view = "raw",
	exportStatus = { json: false, txt: false },
	lastSaveText = "";

function save() {
	saveState(state, activeDocumentId);
	lastSaveText = "已自動儲存 " + new Date().toLocaleTimeString();
	renderer.renderSaveStatus();
	renderDocumentPicker();
}

function changed() {
	exportStatus = { json: false, txt: false };
	save();
	renderer.renderOut();
}

const renderer = createRenderer({
	getState: () => state,
	getView: () => view,
	getExportStatus: () => exportStatus,
	getLastSaveText: () => lastSaveText,
	changed,
	onPresetClick: (type) => {
		if (confirm("切換模板會取代目前表單，確定？")) {
			state = makeState(type);
			changed();
			renderer.render();
		}
	},
});

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

function asciiCompare(a, b) {
	const left = String(a || "");
	const right = String(b || "");
	const length = Math.min(left.length, right.length);

	for (let i = 0; i < length; i++) {
		const diff = left.charCodeAt(i) - right.charCodeAt(i);
		if (diff !== 0) return diff;
	}

	return left.length - right.length;
}

function renderDocumentPicker() {
	const select = document.getElementById("storageDocSelect");
	const nameInput = document.getElementById("storageDocName");
	if (!select) return;
	const docs = ensureDocumentIndex().sort((a, b) =>
		asciiCompare(a.name, b.name),
	);
	select.innerHTML = "";
	docs.forEach((doc) => {
		const option = document.createElement("option");
		option.value = doc.id;
		option.textContent = doc.name || "未命名";
		select.appendChild(option);
	});
	select.value = activeDocumentId;
	if (nameInput && document.activeElement !== nameInput) {
		const active = docs.find((d) => d.id === activeDocumentId);
		nameInput.value = active?.name || "";
	}
}

function loadDocument(id) {
	if (!id || id === activeDocumentId) return;
	activeDocumentId = id;
	setActiveDocumentId(id);
	state = normalizeState(loadState(activeDocumentId)) || makeState();
	exportStatus = { json: false, txt: false };
	lastSaveText = "已讀取 " + (getActiveDocument()?.name || "文件");
	renderer.render();
	renderDocumentPicker();
	renderer.toast(lastSaveText);
}

function setupDocumentStorageUi() {
	const select = document.getElementById("storageDocSelect");
	const nameInput = document.getElementById("storageDocName");
	const newBtn = document.getElementById("storageNew");
	const renameBtn = document.getElementById("storageRename");
	const deleteBtn = document.getElementById("storageDelete");
	if (!select || !nameInput || !newBtn || !renameBtn || !deleteBtn) return;
	select.onchange = () => loadDocument(select.value);
	nameInput.onkeydown = (event) => { if (event.key === "Enter") renameBtn.click(); };
	renameBtn.onclick = () => {
		const doc = renameDocument(activeDocumentId, nameInput.value);
		renderDocumentPicker();
		renderer.toast(doc ? "名稱已更新" : "找不到目前文件");
	};
	newBtn.onclick = () => {
		const name = prompt("新文件名稱", state.title || "新文件") || "新文件";
		const nextState = makeState(state.noteType || "porting");
		nextState.title = name;
		const doc = createDocument(name, nextState);
		activeDocumentId = doc.id;
		state = normalizeState(loadState(activeDocumentId)) || nextState;
		exportStatus = { json: false, txt: false };
		lastSaveText = "已建立 " + doc.name;
		renderer.render();
		renderDocumentPicker();
		renderer.toast(lastSaveText);
	};
	deleteBtn.onclick = () => {
		const doc = getActiveDocument();
		if (!doc) return;
		if (!confirm(`刪除 localStorage 文件「${doc.name}」？`)) return;
		if (!deleteDocument(activeDocumentId)) {
			renderer.toast("至少需要保留一份文件");
			return;
		}
		activeDocumentId = getActiveDocumentId();
		state = normalizeState(loadState(activeDocumentId)) || makeState();
		lastSaveText = "已刪除文件";
		renderer.render();
		renderDocumentPicker();
		renderer.toast(lastSaveText);
	};
	renderDocumentPicker();
}

function parsePatchToImplementationUnits(text) {
	const arr = String(text || "")
		.split(/^diff --git /m)
		.filter(Boolean);
	return arr
		.map((x) => "diff --git " + x)
		.map((chunk) => {
			const m = chunk.match(/^diff --git\s+a\/(.+?)\s+b\/(.+?)\s*$/m);
			const path = m ? m[2] : "patch.diff";
			return impl(
				path.split("/").pop(),
				path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".",
				"diff",
				chunk.trim(),
			);
		})
		.filter((u) => u.content);
}

function findOrCreateImplementationSection() {
	let s = state.sections.find((x) => x.title === "實作流程");
	if (!s) {
		s = sec("實作流程", true);
		state.sections.push(s);
	}
	s.enabled = true;
	return s;
}

function setupWorkspaceResize() {
	const workspace = document.getElementById("workspace");
	const resizer = document.getElementById("workspaceResizer");

	if (!workspace || !resizer) return;

	const storageKey = KEY + ":workspaceLayout";
	const desktopQuery = window.matchMedia("(min-width: 901px)");

	const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

	const applySideWidth = (sideWidth) => {
		if (!desktopQuery.matches) {
			workspace.style.removeProperty("--output-col");
			workspace.style.removeProperty("--side-col");
			return;
		}

		const rect = workspace.getBoundingClientRect();
		const resizerWidth = resizer.getBoundingClientRect().width || 10;
		const gap = 16;
		const available = rect.width - resizerWidth - gap;
		const minOutput = 560;
		const minSide = 340;
		const maxSide = Math.max(minSide, available - minOutput);
		const nextSideWidth = clamp(sideWidth, minSide, maxSide);

		workspace.style.setProperty("--output-col", "minmax(" + minOutput + "px, 1fr)");
		workspace.style.setProperty("--side-col", nextSideWidth + "px");

		localStorage.setItem(storageKey, String(nextSideWidth));
	};

	const restore = () => {
		const saved = Number(localStorage.getItem(storageKey));
		if (Number.isFinite(saved) && saved > 0) {
			applySideWidth(saved);
		} else {
			applySideWidth(420);
		}
	};

	let dragging = false;

	const onPointerMove = (event) => {
		if (!dragging || !desktopQuery.matches) return;

		const rect = workspace.getBoundingClientRect();
		const sideWidth = event.clientX - rect.left - 8;

		applySideWidth(sideWidth);
	};

	const stopDragging = () => {
		if (!dragging) return;

		dragging = false;
		resizer.classList.remove("is-dragging");
		document.body.classList.remove("is-resizing");

		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", stopDragging);
		window.removeEventListener("pointercancel", stopDragging);
	};

	resizer.addEventListener("pointerdown", (event) => {
		if (!desktopQuery.matches) return;

		dragging = true;
		resizer.classList.add("is-dragging");
		document.body.classList.add("is-resizing");
		resizer.setPointerCapture?.(event.pointerId);

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", stopDragging);
		window.addEventListener("pointercancel", stopDragging);

		event.preventDefault();
	});

	resizer.addEventListener("keydown", (event) => {
		if (!desktopQuery.matches) return;

		const current = Number(localStorage.getItem(storageKey)) || 420;
		const step = event.shiftKey ? 40 : 20;

		if (event.key === "ArrowLeft") {
			applySideWidth(current + step);
			event.preventDefault();
		}

		if (event.key === "ArrowRight") {
			applySideWidth(current - step);
			event.preventDefault();
		}

		if (event.key === "Home") {
			applySideWidth(340);
			event.preventDefault();
		}

		if (event.key === "End") {
			applySideWidth(720);
			event.preventDefault();
		}
	});

	const syncMode = () => restore();

	if (typeof desktopQuery.addEventListener === "function") {
		desktopQuery.addEventListener("change", syncMode);
	} else {
		desktopQuery.addListener(syncMode);
	}

	window.addEventListener("resize", restore);

	restore();
}

function applyColorToTextareaSelection(el, color) {
	const start = el.selectionStart;
	const end = el.selectionEnd;

	if (
		typeof start !== "number" ||
		typeof end !== "number" ||
		start === end
	) {
		return false;
	}

	const value = el.value;
	const selected = value.slice(start, end);

	const whole = selected.match(/^%\{color:[^}]+\}([\s\S]*)%$/);

	if (whole) {
		const wrapped = buildColored(color, whole[1]);

		el.value = value.slice(0, start) + wrapped + value.slice(end);
		el.focus();
		el.setSelectionRange(start, start + wrapped.length);
		el.dispatchEvent(
			new InputEvent("input", {
				bubbles: true,
				inputType: "insertText",
				data: wrapped,
			}),
		);

		return true;
	}

	const range = findColorRange(value, start, end);

	if (range && start >= range.contentStart && end <= range.contentEnd) {
		const beforeInner = value.slice(range.contentStart, start);
		const selectedInner = value.slice(start, end);
		const afterInner = value.slice(end, range.contentEnd);

		let replacement = "";

		if (beforeInner) {
			replacement += buildColored(range.oldColor, beforeInner);
		}

		replacement += buildColored(color, selectedInner);

		if (afterInner) {
			replacement += buildColored(range.oldColor, afterInner);
		}

		el.value =
			value.slice(0, range.matchStart) +
			replacement +
			value.slice(range.matchEnd);

		const newStart =
			range.matchStart +
			(beforeInner ? buildColored(range.oldColor, beforeInner).length : 0);
		const newEnd = newStart + buildColored(color, selectedInner).length;

		el.focus();
		el.setSelectionRange(newStart, newEnd);
		el.dispatchEvent(
			new InputEvent("input", {
				bubbles: true,
				inputType: "insertText",
				data: replacement,
			}),
		);

		return true;
	}

	const wrapped = buildColored(color, selected);

	el.value = value.slice(0, start) + wrapped + value.slice(end);
	el.focus();
	el.setSelectionRange(start, start + wrapped.length);
	el.dispatchEvent(
		new InputEvent("input", {
			bubbles: true,
			inputType: "insertText",
			data: wrapped,
		}),
	);

	return true;
}

function clearColorFromTextareaSelection(el) {
	const start = el.selectionStart;
	const end = el.selectionEnd;

	if (
		typeof start !== "number" ||
		typeof end !== "number" ||
		start === end
	) {
		return false;
	}

	const value = el.value;
	const range = findColorRange(value, start, end);

	if (range && start >= range.contentStart && end <= range.contentEnd) {
		const before = value.slice(range.contentStart, start);
		const selected = value.slice(start, end);
		const after = value.slice(end, range.contentEnd);

		let replacement = "";

		if (before) {
			replacement += buildColored(range.oldColor, before);
		}

		replacement += selected;

		if (after) {
			replacement += buildColored(range.oldColor, after);
		}

		el.value =
			value.slice(0, range.matchStart) +
			replacement +
			value.slice(range.matchEnd);

		const newStart =
			range.matchStart +
			(before ? buildColored(range.oldColor, before).length : 0);

		el.focus();
		el.setSelectionRange(newStart, newStart + selected.length);
		el.dispatchEvent(
			new InputEvent("input", {
				bubbles: true,
				inputType: "insertText",
				data: replacement,
			}),
		);

		return true;
	}

	const selected = value.slice(start, end);
	const cleaned = selected.replace(/%\{color:[^}]+\}([\s\S]*?)%/g, "$1");

	el.value = value.slice(0, start) + cleaned + value.slice(end);
	el.focus();
	el.setSelectionRange(start, start + cleaned.length);
	el.dispatchEvent(
		new InputEvent("input", {
			bubbles: true,
			inputType: "insertText",
			data: cleaned,
		}),
	);

	return true;
}

function buildColored(color, text) {
	return `%{color:${color}}${text}%`;
}

function findColorRange(value, start, end) {
	const re = /%\{color:([^}]+)\}([\s\S]*?)%/g;
	let m;

	while ((m = re.exec(value))) {
		const matchStart = m.index;
		const contentStart = matchStart + m[0].indexOf("}") + 1;
		const contentEnd = matchStart + m[0].length - 1;
		const matchEnd = matchStart + m[0].length;

		if (start >= matchStart && end <= matchEnd) {
			return {
				oldColor: m[1],
				matchStart,
				contentStart,
				contentEnd,
				matchEnd,
				inner: m[2],
			};
		}
	}

	return null;
}

function setupTextColorContextMenu() {
	let targetInput = null;

	const menu = document.createElement("div");
	menu.id = "textColorMenu";
	menu.className = "text-color-menu";
	menu.innerHTML = `
		<button type="button" class="red" data-color="red">標成紅色</button>
		<button type="button" class="green" data-color="green">標成綠色</button>
		<button type="button" class="orange" data-color="orange">標成橘色</button>
		<button type="button" data-clear-color="true">清除顏色</button>
	`;
	document.body.appendChild(menu);

	const hideMenu = () => {
		menu.classList.remove("show");
	};

	const isEditableTextField = (el) =>
		el &&
		(el.tagName === "TEXTAREA" ||
			(el.tagName === "INPUT" &&
				["text", "search", "url", "email"].includes(el.type)));

	document.addEventListener("contextmenu", (event) => {
		const el = event.target;

		if (!isEditableTextField(el)) {
			hideMenu();
			return;
		}

		const start = el.selectionStart;
		const end = el.selectionEnd;

		if (
			typeof start !== "number" ||
			typeof end !== "number" ||
			start === end
		) {
			hideMenu();
			return;
		}

		targetInput = el;
		event.preventDefault();

		menu.style.left = `${event.clientX}px`;
		menu.style.top = `${event.clientY}px`;
		menu.classList.add("show");
	});

	menu.addEventListener("click", (event) => {
		const btn = event.target.closest("button");
		if (!btn || !targetInput) return;

		if (btn.dataset.color) {
			applyColorToTextareaSelection(targetInput, btn.dataset.color);
		}

		if (btn.dataset.clearColor) {
			clearColorFromTextareaSelection(targetInput);
		}

		hideMenu();
	});

	document.addEventListener("click", (event) => {
		if (!menu.contains(event.target)) {
			hideMenu();
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			hideMenu();
		}
	});

	window.addEventListener("scroll", hideMenu, true);
	window.addEventListener("resize", hideMenu);
}

function setupTheme() {
	const btn = document.getElementById("themeToggle"),
		key = KEY + ":theme";
	const apply = (t) => {
		document.body.dataset.theme = t;
		btn.textContent = t === "dark" ? "淺色模式" : "深色模式";
	};
	apply(
		localStorage.getItem(key) ||
			(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
	);
	btn.onclick = () => {
		const next = document.body.dataset.theme === "dark" ? "light" : "dark";
		localStorage.setItem(key, next);
		apply(next);
	};
}

const rawButton = document.getElementById("raw");
if (rawButton) {
	rawButton.onclick = () => {
		view = "raw";
		renderer.renderOut();
	};
}

const previewButton = document.getElementById("previewbtn");
if (previewButton) {
	previewButton.onclick = () => {
		view = "preview";
		renderer.renderOut();
	};
}

const stateButton = document.getElementById("statebtn");
if (stateButton) {
	stateButton.onclick = () => {
		view = "json";
		renderer.renderOut();
	};
}

document.getElementById("copy").onclick = async () => {
	const t = textile(state);
	try {
		await navigator.clipboard.writeText(t);
		download(
			safe(state.title) + ".json",
			JSON.stringify(state, null, 2),
			"application/json",
		);
	} catch {
		document.getElementById("out").select();
		document.execCommand("copy");
	}
	renderer.toast("已複製 Redmine Textile, 強制儲存至 JSON file");
	exportStatus.json = true;
	renderer.renderSaveStatus();
};

document.getElementById("txt").onclick = () => {
	download(safe(state.title) + ".textile", textile(state), "text/plain");
	exportStatus.txt = true;
	renderer.renderSaveStatus();
};

document.getElementById("json").onclick = () => {
	download(
		safe(state.title) + ".json",
		JSON.stringify(state, null, 2),
		"application/json",
	);
	exportStatus.json = true;
	renderer.renderSaveStatus();
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
			if (!obj.environment || !Array.isArray(obj.sections))
				throw Error("格式不符合");
			state = normalizeState(obj);
			changed();
			renderer.render();
			renderer.toast("JSON 已匯入");
		} catch (err) {
			alert("JSON 匯入失敗：" + err.message);
		}
	};
	r.readAsText(f);
	e.target.value = "";
};

document.getElementById("patch").onclick = () =>
	document.getElementById("patchFile").click();

document.getElementById("patchFile").onchange = (e) => {
	const f = e.target.files[0];
	if (!f) return;
	const r = new FileReader();
	r.onload = () => {
		const units = parsePatchToImplementationUnits(r.result);
		if (!units.length) {
			alert("Patch 匯入失敗：找不到 diff 區塊");
			return;
		}
		findOrCreateImplementationSection().blocks.push(...units);
		changed();
		renderer.render();
		renderer.toast(`已匯入 ${units.length} 個 Implementation Unit`);
	};
	r.readAsText(f);
	e.target.value = "";
};

document.getElementById("reset").onclick = () => {
	const doc = getActiveDocument();
	if (confirm(`清除目前文件「${doc?.name || "預設文件"}」並重設？`)) {
		localStorage.removeItem(documentStateKey(activeDocumentId));
		state = makeState();
		changed();
		renderer.render();
	}
};

document.getElementById("addSection").onclick = () => renderer.addSection();

document.querySelectorAll("[data-snip]").forEach(
	(b) =>
		(b.onclick = () => {
			renderer.addVerificationSnippet(b.dataset.snip);
		}),
);

document.addEventListener("click", (e) => {
	const btn = e.target.closest("[data-collapse-target]");
	if (!btn) return;
	const target = document.getElementById(btn.dataset.collapseTarget);
	if (!target) return;
	const expanded = btn.getAttribute("aria-expanded") !== "false";
	const nextCollapsed = expanded;
	btn.setAttribute("aria-expanded", String(!nextCollapsed));
	target.classList.toggle("collapsed", nextCollapsed);

	const scope = btn.dataset.collapseScope;
	const key = btn.dataset.collapseKey;
	if (scope && key) {
		state.ui ||= {};
		state.ui.collapsed ||= {};
		state.ui.collapsed[scope] ||= {};
		state.ui.collapsed[scope][key] = nextCollapsed;
		changed();
	}
});

document.getElementById("source_code").onclick = () => {
	window.open(
		"https://github.com/davidchen0970/RedmineTemplateEditor",
		"_blank",
		"noopener")
}

setupTheme();
setupWorkspaceResize();
setupDocumentStorageUi();
setupTextColorContextMenu();
save();
renderer.render();
setupMobileHeaderCollapse();
