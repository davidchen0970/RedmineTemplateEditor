import {
	KEY,
	makeState,
	loadState,
	saveState,
	safe,
	impl,
	sec,
} from "./js/state.js";
import { textile } from "./js/textile.js";
import { createRenderer } from "./js/renderer.js";

let state = loadState() || makeState(),
	view = "raw",
	exportStatus = { json: false, txt: false },
	lastSaveText = "";

function save() {
	saveState(state);
	lastSaveText = "已自動儲存 " + new Date().toLocaleTimeString();
	renderer.renderSaveStatus();
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
			state = obj;
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
	if (confirm("清除 localStorage 並重設？")) {
		localStorage.removeItem(KEY);
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
	btn.setAttribute("aria-expanded", String(!expanded));
	target.classList.toggle("collapsed", expanded);
});

document.getElementById("source_code").onclick = () => {
	window.open(
		"https://github.com/davidchen0970/RedmineTemplateEditor",
		"_blank",
		"noopener")
}

setupTheme();
setupWorkspaceResize();
save();
renderer.render();
