import { textile } from "../textile/generator.js";
import { textileToPreviewHtml } from "../textile/preview.js";
import { exportMermaidPng } from "./mermaid-export.js";
import { onPreviewReRender } from "./preview-scroll-burst.js";

export function renderOutput(state, view) {
	const raw = textile(state);
	const output = document.getElementById("out");
	const preview = document.getElementById("preview");
	output.value = view === "json" ? JSON.stringify(state, null, 2) : raw;
	output.classList.toggle("hidden", view === "preview");
	preview.classList.toggle("hidden", view !== "preview");
	if (view === "preview") {
		onPreviewReRender(preview);
		preview.innerHTML = textileToPreviewHtml(raw);
		renderMermaidDiagrams(preview);
	}
	document.querySelectorAll(".segmented button").forEach((button) => button.classList.remove("active"));
	const activeId = { raw: "raw", preview: "previewbtn", json: "statebtn" }[view];
	document.getElementById(activeId)?.classList.add("active");
	slideSegmentedIndicator();
	const stats = document.getElementById("stats");
	if (stats) stats.textContent = `${raw.length} 字元 · ${raw.split("\n").length} 行`;
}

export function segmentedIndicatorPosition(groupRect, buttonRect) {
	return {
		left: Math.round(buttonRect.left - groupRect.left),
		width: Math.round(buttonRect.width),
	};
}

function slideSegmentedIndicator() {
	const group = document.querySelector(".segmented");
	const active = group?.querySelector(".active");
	if (!group || !active) return;
	const pos = segmentedIndicatorPosition(
		group.getBoundingClientRect(),
		active.getBoundingClientRect()
	);
	group.style.setProperty("--seg-left", `${pos.left}px`);
	group.style.setProperty("--seg-w", `${pos.width}px`);
}

if (typeof window !== "undefined") {
	window.addEventListener("resize", slideSegmentedIndicator);
}

const mermaidCache = new Map();
let lastMermaidHeights = [];

function renderMermaidDiagrams(preview) {
	const hosts = [...preview.querySelectorAll(".mermaid")];
	const toRender = [];
	hosts.forEach((host, index) => {
		const source = host.getAttribute("data-mermaid-source") ?? "";
		const cached = mermaidCache.get(source);
		if (cached) {
			host.innerHTML = cached.html;
			host.style.height = Math.round(cached.height) + "px";
			host.classList.add("mermaid-with-toolbar");
		} else {
			const reserved = lastMermaidHeights[index];
			if (reserved && reserved > 0) {
				host.style.height = Math.round(reserved) + "px";
			}
			toRender.push({ host, index });
		}
	});

	addMermaidDownloadButtons(preview);

	if (toRender.length === 0 || !window.mermaid) return;
	toRender.forEach(({ host }) => host.classList.add("mermaid-needs-render"));
	window.mermaid
		.run({ querySelector: ".mermaid-needs-render" })
		.then(() => {
			const nextHeights = hosts.map((host) => {
				host.classList.remove("mermaid-needs-render");
				const svg = host.querySelector("svg");
				if (!svg) return 0;
				const height = Math.round(svg.getBoundingClientRect().height) || 0;
				if (height > 0) host.style.height = height + "px";
				const source = host.getAttribute("data-mermaid-source");
				if (source != null) {
					mermaidCache.set(source, { html: svg.outerHTML, height });
				}
				return height;
			});
			lastMermaidHeights = nextHeights;
			addMermaidDownloadButtons(preview);
		})
		.catch(() => {});
}

function addMermaidDownloadButtons(preview) {
	preview.querySelectorAll(".mermaid").forEach((host) => {
		const svgElement = host.querySelector("svg");
		if (!svgElement || host.querySelector(".mermaid-download")) return;

		const button = document.createElement("button");
		button.type = "button";
		button.className = "mermaid-download";
		button.title = "下載 PNG";
		button.textContent = "↓ PNG";
		button.addEventListener("click", () => {
			openMermaidExportDialog(svgElement, screenshotFileName());
		});
		host.classList.add("mermaid-with-toolbar");
		host.appendChild(button);
	});
}

let pendingMermaidExport = null;

// Screenshot_YYYYMMDD_HHMMSS.png (local time)
function screenshotFileName() {
	const d = new Date();
	const pad = (n) => String(n).padStart(2, "0");
	const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
	const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
	return `Screenshot_${date}_${time}.png`;
}

function openMermaidExportDialog(svgElement, fileName) {
	const dialog = ensureMermaidExportDialog();
	pendingMermaidExport = { svgElement, fileName };
	dialog.querySelector("#mermaidSizeMode").value = "scale";
	syncMermaidSizeFields(dialog);
	dialog.showModal();
	dialog.querySelector("#mermaidScale").focus();
}

function ensureMermaidExportDialog() {
	let dialog = document.getElementById("mermaidExportDialog");
	if (dialog) return dialog;
	dialog = document.createElement("dialog");
	dialog.id = "mermaidExportDialog";
	dialog.className = "add-block-dialog";
	dialog.innerHTML = `
		<form method="dialog" id="mermaidExportForm">
			<div class="dialog-head">下載 PNG</div>
			<div class="dialog-body">
				<div class="field">
					<label>尺寸方式</label>
					<select id="mermaidSizeMode">
						<option value="scale">倍率（原生解析度 x 倍數）</option>
						<option value="width">固定寬度（px）</option>
					</select>
				</div>
				<div class="field" id="mermaidScaleWrap">
					<label>倍率</label>
					<select id="mermaidScale">
						<option value="1">x1</option>
						<option value="1.5">x1.5</option>
						<option value="2" selected>x2</option>
						<option value="3">x3</option>
						<option value="4">x4</option>
					</select>
				</div>
				<div class="field" id="mermaidWidthWrap" style="display:none">
					<label>寬度（px，高度自動等比例）</label>
					<input id="mermaidWidth" type="number" min="16" step="1" value="1920">
				</div>
			</div>
			<div class="dialog-actions">
				<button type="button" id="mermaidExportCancel">取消</button>
				<button type="submit" class="primary">下載</button>
			</div>
		</form>`;
	document.body.appendChild(dialog);
	dialog.querySelector("#mermaidSizeMode").onchange = () => syncMermaidSizeFields(dialog);
	dialog.querySelector("#mermaidExportCancel").onclick = () => {
		pendingMermaidExport = null;
		dialog.close();
	};
	dialog.querySelector("#mermaidExportForm").onsubmit = (event) => {
		event.preventDefault();
		const target = pendingMermaidExport;
		pendingMermaidExport = null;
		dialog.close();
		if (!target) return;
		let options = {};
		if (dialog.querySelector("#mermaidSizeMode").value === "width") {
			const w = parseFloat(dialog.querySelector("#mermaidWidth").value);
			if (Number.isFinite(w) && w > 0) options.width = w;
		} else {
			options.scale = parseFloat(dialog.querySelector("#mermaidScale").value) || 2;
		}
		exportMermaidPng(target.svgElement, target.fileName, options);
	};
	return dialog;
}

function syncMermaidSizeFields(dialog) {
	const useWidth = dialog.querySelector("#mermaidSizeMode").value === "width";
	dialog.querySelector("#mermaidScaleWrap").style.display = useWidth ? "none" : "";
	dialog.querySelector("#mermaidWidthWrap").style.display = useWidth ? "" : "none";
}
