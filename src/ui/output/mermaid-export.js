const EXPORT_SCALE = 2;
const RENDER_WAIT_MS = 600;

import { resolveLabelColor, wrapLabelRuns } from "./mermaid-label.js";

export function exportMermaidPng(svgElement, fileName, options = {}) {
	if (!svgElement) return Promise.resolve();
	return (async () => {
		try {
			if (document.fonts && document.fonts.ready) await document.fonts.ready;
			const prepared = prepareExportSvg(svgElement);
			const scale = resolveExportScale(svgElement, options);
			const blob = await svgToPngBlob(prepared, scale);
			downloadBlob(blob, fileName);
		} catch (error) {
			console.error("Mermaid PNG 下載失敗:", error);
			downloadSvgFallback(preparedSvgText(svgElement), fileName);
		}
	})();
}

function resolveExportScale(svgElement, options) {
	const size = getSvgSize(svgElement);
	if (options.width > 0 && size.w > 0) return options.width / size.w;
	if (options.scale > 0) return options.scale;
	return EXPORT_SCALE;
}

function prepareExportSvg(live) {
	const size = getSvgSize(live);
	const root = live.cloneNode(true);
	root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	root.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
	root.setAttribute("viewBox", `${size.x} ${size.y} ${size.w} ${size.h}`);
	root.setAttribute("width", String(size.w));
	root.setAttribute("height", String(size.h));

	// inline computed styles so the clone doesn't rely on page CSS
	const STYLE_PROPS = [
		"font-family", "font-size", "font-weight", "font-style",
		"fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity",
		"stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset",
		"text-anchor", "dominant-baseline", "opacity", "color", "letter-spacing", "white-space",
	];
	const sourceNodes = [live, ...live.querySelectorAll("*")];
	const clonedNodes = [root, ...root.querySelectorAll("*")];
	sourceNodes.forEach((node, index) => {
		const clone = clonedNodes[index];
		if (!clone || node.nodeType !== 1) return;
		const cs = getComputedStyle(node);
		const inline = STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");
		clone.setAttribute("style", (clone.getAttribute("style") || "") + ";" + inline);
	});

	// foreignObject taints canvas in Chromium/Edge, so replace it with <text>
	const liveFOs = [...live.querySelectorAll("foreignObject")];
	const metrics = liveFOs.map((fo) => labelMetrics(fo));
	const cloneFOs = [...root.querySelectorAll("foreignObject")];
	cloneFOs.forEach((fo, index) => {
		replaceForeignObjectWithText(fo, metrics[index]);
	});

	// opaque white background
	const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	background.setAttribute("x", String(size.x));
	background.setAttribute("y", String(size.y));
	background.setAttribute("width", String(size.w));
	background.setAttribute("height", String(size.h));
	background.setAttribute("fill", "#ffffff");
	root.insertBefore(background, root.firstChild);

	return { svgText: new XMLSerializer().serializeToString(root), width: size.w, height: size.h };
}

function getSvgSize(svgElement) {
	const vb = svgElement.viewBox && svgElement.viewBox.baseVal;
	if (vb && vb.width > 0 && vb.height > 0) {
		return { x: vb.x || 0, y: vb.y || 0, w: vb.width, h: vb.height };
	}
	const widthAttr = svgElement.getAttribute("width") || "";
	const heightAttr = svgElement.getAttribute("height") || "";
	const width = /^\d+(\.\d+)?(px)?$/i.test(widthAttr) ? parseFloat(widthAttr) : 0;
	const height = /^\d+(\.\d+)?(px)?$/i.test(heightAttr) ? parseFloat(heightAttr) : 0;
	if (width > 0 && height > 0) return { x: 0, y: 0, w: width, h: height };
	try {
		const box = svgElement.getBoundingClientRect();
		return {
			x: 0,
			y: 0,
			w: Math.max(1, Math.ceil(box.width || 1200)),
			h: Math.max(1, Math.ceil(box.height || 800)),
		};
	} catch {
		console.warn("[mermaid-export] failed to measure SVG size");
		return { x: 0, y: 0, w: 1200, h: 800 };
	}
}

function labelMetrics(fo) {
	const probe = fo.querySelector("div, p, span, body") || fo;
	let cs = null;
	try {
		cs = fo.ownerDocument.defaultView.getComputedStyle(probe);
	} catch {
		cs = null;
	}
	let fontSize = parseFloat(cs?.fontSize || "");
	if (!Number.isFinite(fontSize) || fontSize === 0) fontSize = 16;
	const fontFamily = cs?.fontFamily || "sans-serif";
	let fill = "#333333";
	const color = cs?.color;
	if (color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
		fill = color;
	}
	return { fontSize, fontFamily, fill };
}

// Walk the HTML inside a <foreignObject> label and split it into *lines* (at <br>
// and block elements), each line being an array of styled *runs* -- contiguous
// pieces of text carrying the resolved text color and bold flag of the element they
// came from (e.g. <font color='red'>…</font> / <b>…</b>). This preserves
// per-word colour instead of flattening the label to the wrapper's computed style.
function labelRuns(fo) {
	const BLOCK_TAGS = new Set([
		"p", "div", "section", "article", "header", "footer", "li", "ul", "ol", "tr", "table",
	]);
	const lines = [];
	let currentLine = [];
	const pending = { color: null, bold: false };

	const pushRun = (rawText) => {
		const text = String(rawText ?? "").replace(/\s+/g, " ").trim();
		if (!text) return;
		const lastRun = currentLine[currentLine.length - 1];
		if (lastRun && lastRun.color === pending.color && lastRun.bold === pending.bold) {
			lastRun.text += (lastRun.text ? " " : "") + text;
		} else {
			currentLine.push({ text, color: pending.color, bold: pending.bold });
		}
	};
	const pushLine = () => {
		if (currentLine.length) lines.push(currentLine);
		currentLine = [];
	};

	const walk = (node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			pushRun(node.textContent);
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return;
		const tag = node.tagName.toLowerCase();
		if (tag === "br") {
			pushLine();
			return;
		}
		const isBlock = BLOCK_TAGS.has(tag);
		if (isBlock) pushLine();

		const prevColor = pending.color;
		const prevBold = pending.bold;
		if (tag === "b" || tag === "strong") pending.bold = true;

		const cs = node.ownerDocument.defaultView.getComputedStyle(node);
		if (cs && cs.color && cs.color !== "rgba(0, 0, 0, 0)" && cs.color !== "transparent") {
			pending.color = cs.color;
		} else if (tag === "font" && node.getAttribute && node.getAttribute("color")) {
			pending.color = node.getAttribute("color");
		}

		Array.from(node.childNodes).forEach(walk);

		pending.color = prevColor;
		pending.bold = prevBold;
		if (isBlock) pushLine();
	};

	Array.from(fo.childNodes).forEach(walk);
	pushLine();
	if (!lines.length) {
		const plain = (fo.textContent || "").replace(/\s+/g, " ").trim();
		if (plain) lines.push([{ text: plain, color: null, bold: false }]);
	}
	return lines;
}

// Replace a <foreignObject> with a <g> of <text> elements -- one <text> per
// label line, each line containing one <tspan> per styled run. Keeps <br> line
// breaks, adds width-based auto wrapping for long labels, and preserves per-word
// text colour and bold (foreignObject also taints the canvas, so it must be removed).
function replaceForeignObjectWithText(fo, metrics) {
	const baseLines = labelRuns(fo);
	if (!baseLines.length) {
		fo.remove();
		return;
	}
	const fontSpec = metrics || labelMetrics(fo);
	const fontSize = fontSpec.fontSize || 16;
	const fontFamily = fontSpec.fontFamily || "sans-serif";
	const defaultFill = fontSpec.fill || "#333333";

	const x = parseFloat(fo.getAttribute("x") || "0") || 0;
	const y = parseFloat(fo.getAttribute("y") || "0") || 0;
	const w = parseFloat(fo.getAttribute("width") || "0") || 0;
	const h = parseFloat(fo.getAttribute("height") || "0") || 0;

	const wrapWidth = Math.max(16, w || 120);
	const lineHeight = Math.round(fontSize * 1.3);
	const anchorX = x + (w ? w / 2 : 0);

	const lines = [];
	baseLines.forEach((runs) =>
		lines.push(...wrapLabelRuns(runs, wrapWidth, fontSize, fontFamily)),
	);

	const blockHeight = lines.length * lineHeight;
	const centerY = (h ? y + h / 2 : y) - blockHeight / 2 + lineHeight / 2;

	const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
	lines.forEach((runs, li) => {
		const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
		text.setAttribute("x", String(Math.round(anchorX * 100) / 100));
		text.setAttribute("y", String(Math.round((centerY + li * lineHeight) * 100) / 100));
		text.setAttribute("text-anchor", "middle");
		text.setAttribute("dominant-baseline", "middle");
		text.setAttribute(
			"style",
			`font-family:${fontFamily};font-size:${fontSize}px;font-weight:400;fill:${defaultFill};stroke:none;`,
		);
		runs.forEach((run, ri) => {
			const tsp = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
			tsp.setAttribute("fill", resolveLabelColor(run.color) || defaultFill);
			if (run.bold) tsp.setAttribute("font-weight", "700");
			// Separate differently-styled runs with a single space so adjacent
			// coloured fragments don't render as one concatenated word.
			tsp.textContent = (ri > 0 ? " " : "") + run.text;
			text.appendChild(tsp);
		});
		group.appendChild(text);
	});
	fo.replaceWith(group);
}

function preparedSvgText(svgElement) {
	try {
		return prepareExportSvg(svgElement).svgText;
	} catch {
		return new XMLSerializer().serializeToString(svgElement);
	}
}

async function svgToPngBlob(prepared, scale = EXPORT_SCALE) {
	const { svgText, width, height } = prepared;
	if (!(width > 0) || !(height > 0)) throw new Error("無法取得 SVG 尺寸");

	const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
	const objectUrl = URL.createObjectURL(svgBlob);
	try {
		const image = new Image();
		await new Promise((resolve, reject) => {
			image.onload = () => setTimeout(resolve, RENDER_WAIT_MS);
			image.onerror = () => reject(new Error("SVG 無法載入為圖片"));
			image.src = objectUrl;
		});

		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.ceil(width * scale));
		canvas.height = Math.max(1, Math.ceil(height * scale));
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("瀏覽器無法建立 Canvas 2D 環境");
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

		const blob = await new Promise((resolve, reject) => {
			try {
				canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("瀏覽器未能建立 PNG"))), "image/png");
			} catch (error) {
				reject(error);
			}
		});
		return blob;
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

function downloadBlob(blob, fileName) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadSvgFallback(svgText, fileName) {
	try {
		const anchor = document.createElement("a");
		anchor.download = fileName.replace(/\.png$/i, ".svg");
		anchor.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
	} catch (error) {
		console.warn("[mermaid-export] SVG fallback failed:", error);
	}
}
