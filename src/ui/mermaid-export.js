const EXPORT_SCALE = 2;
const RENDER_WAIT_MS = 600;

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

function collectLabelLines(node) {
	const lines = [];
	let current = "";
	const push = () => {
		const s = current.replace(/\s+/g, " ").trim();
		if (s) lines.push(s);
		current = "";
	};
	const walk = (n) => {
		if (n.nodeType === Node.TEXT_NODE) {
			current += n.textContent || "";
			return;
		}
		if (n.nodeType !== Node.ELEMENT_NODE) return;
		const tag = n.tagName.toLowerCase();
		if (tag === "br") {
			push();
			return;
		}
		const block = ["p", "div", "section", "article", "header", "footer", "li", "ul", "ol"].includes(tag);
		if (block) push();
		Array.from(n.childNodes).forEach(walk);
		if (block) push();
	};
	Array.from(node.childNodes).forEach(walk);
	push();
	return lines.length ? lines : [(node.textContent || "").replace(/\s+/g, " ").trim()].filter(Boolean);
}

function wrapLabelLine(line, maxChars) {
	if (maxChars < 1 || line.length <= maxChars) return [line];
	const chunks = [];
	let current = "";
	line.split(/\s+/).forEach((tok) => {
		if (!tok) return;
		let piece = tok;
		while (piece.length > maxChars) {
			if (current) {
				chunks.push(current);
				current = "";
			}
			chunks.push(piece.slice(0, maxChars));
			piece = piece.slice(maxChars);
		}
		const sep = current ? " " : "";
		if ((current + sep + piece).length <= maxChars) {
			current = current ? current + sep + piece : piece;
		} else {
			if (current) chunks.push(current);
			current = piece;
		}
	});
	if (current) chunks.push(current);
	return chunks;
}

function replaceForeignObjectWithText(fo, metrics) {
	const baseLines = collectLabelLines(fo);
	if (!baseLines.length) {
		fo.remove();
		return;
	}
	const fontSpec = metrics || labelMetrics(fo);
	const fontSize = fontSpec.fontSize || 16;
	const fontFamily = fontSpec.fontFamily || "sans-serif";
	const fill = fontSpec.fill || "#333333";

	const x = parseFloat(fo.getAttribute("x") || "0") || 0;
	const y = parseFloat(fo.getAttribute("y") || "0") || 0;
	const w = parseFloat(fo.getAttribute("width") || "0") || 0;
	const h = parseFloat(fo.getAttribute("height") || "0") || 0;

	const lineHeight = Math.round(fontSize * 1.25);
	const maxChars = Math.max(4, Math.floor((w || 120) / (fontSize * 0.58)));
	const lines = baseLines.flatMap((line) => wrapLabelLine(line, maxChars));

	const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
	t.setAttribute("x", String(x + (w ? w / 2 : 0)));
	t.setAttribute("y", String(y + (h ? h / 2 : 0) - ((lines.length - 1) * lineHeight) / 2));
	t.setAttribute("text-anchor", "middle");
	t.setAttribute("dominant-baseline", "middle");
	t.setAttribute("fill", fill);
	t.setAttribute(
		"style",
		`font-family:${fontFamily};font-size:${fontSize}px;font-weight:400;fill:${fill};stroke:none;`,
	);
	lines.forEach((part, idx) => {
		const tsp = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
		tsp.setAttribute("x", t.getAttribute("x"));
		if (idx > 0) tsp.setAttribute("dy", String(lineHeight));
		tsp.textContent = part;
		t.appendChild(tsp);
	});
	fo.replaceWith(t);
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
