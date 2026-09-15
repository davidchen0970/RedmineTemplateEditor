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

// Turn a normalized color ("red", "rgb(220,38,38)", "#abc", "#aabbcc", "rgba(…)")
// into something a plain SVG renderer reliably paints (#rrggbb or a named keyword),
// or null when there is no usable color.
function resolveLabelColor(value) {
	const v = String(value ?? "").trim().toLowerCase();
	if (!v || v === "transparent" || v === "currentcolor" || v === "none") return null;
	if (/^#[0-9a-f]{6}$/.test(v)) return v;
	if (/^#[0-9a-f]{3}$/.test(v)) return "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
	if (/^[a-z]+$/.test(v)) return v;
	const m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
	if (m) {
		const hex = m
			.slice(1)
			.map((part) => Math.max(0, Math.min(255, Math.round(Number(part)))).toString(16).padStart(2, "0"))
			.join("");
		return "#" + hex;
	}
	return null;
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

// Measure a word/line width with the same (loaded) font the label uses. Falls back
// to a rough 0.58em-per-char estimate if the browser has no canvas measureText.
let labelMeasureCtx = null;
function getLabelMeasureCtx(fontSize, fontFamily) {
	if (!labelMeasureCtx && typeof document !== "undefined") {
		const canvas = document.createElement("canvas");
		try {
			labelMeasureCtx = canvas.getContext("2d") || null;
		} catch {
			labelMeasureCtx = null;
		}
	}
	if (labelMeasureCtx) {
		labelMeasureCtx.font = `${fontSize}px ${fontFamily}`;
	}
	return labelMeasureCtx;
}
function measureLabelText(text, fontSize, fontFamily) {
	let width = 0;
	let ctx = null;
	try {
		ctx = getLabelMeasureCtx(fontSize, fontFamily);
		if (ctx) width = ctx.measureText(text).width;
	} catch {
		ctx = null;
	}
	if (!ctx || !(width > 0)) width = text.length * fontSize * 0.58;
	return width;
}

// Wrap a label *line* (an array of styled runs) into as many sub-lines as fit the
// given box width, measured in REAL pixels via canvas.measureText -- the same metric
// the live preview wraps on -- so exported line breaks match the on-screen preview.
// Words keep the colour/bold of the pop-run they came from.
function wrapLabelRuns(runs, maxWidth, fontSize, fontFamily) {
	const words = [];
	runs.forEach((run) => {
		String(run.text ?? "")
			.split(/\s+/)
			.filter(Boolean)
			.forEach((word) => words.push({ text: word, color: run.color, bold: run.bold }));
	});

	const budget = Math.max(16, maxWidth || 120);
	const outputLines = [];
	let currentWords = [];
	const joinedText = () => currentWords.map((word) => word.text).join(" ");
	const flush = () => {
		if (!currentWords.length) return;
		const line = [];
		currentWords.forEach((word) => {
			const lastRun = line[line.length - 1];
			if (lastRun && lastRun.color === word.color && lastRun.bold === word.bold) {
				lastRun.text += " " + word.text;
			} else {
				line.push({ text: word.text, color: word.color, bold: word.bold });
			}
		});
		outputLines.push(line);
		currentWords = [];
	};

	// Longest prefix of `text` whose real measured width still fits the budget,
	// preferring to stop at a `.` / `_` break so dotted identifiers don't get
	// chopped mid-token.
	const fitBoundary = (text) => {
		let best = 1;
		let lo = 1;
		let hi = text.length;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			if (measureLabelText(text.slice(0, mid), fontSize, fontFamily) <= budget) {
				best = mid;
				lo = mid + 1;
			} else {
				hi = mid - 1;
			}
		}
		for (let i = best; i >= 1; i--) {
			if (text[i - 1] === "." || text[i - 1] === "_") return i;
		}
		return Math.max(1, best);
	};

	words.forEach((word) => {
		let piece = word.text;
		for (;;) {
			const joinedOverflow =
				currentWords.length &&
				measureLabelText(joinedText() + " " + piece, fontSize, fontFamily) > budget;
			if (joinedOverflow) {
				flush();
				continue;
			}
			// The word fits on the current line, or on its own line.
			if (measureLabelText(piece, fontSize, fontFamily) <= budget) break;
			// A lone word wider than the box: slice it at a measured fit boundary
			// (preferring a dot / underscore) so the exported label never overflows.
			const boundary = fitBoundary(piece);
			if (boundary < 1) {
				flush();
				currentWords.push({ text: piece[0], color: word.color, bold: word.bold });
				piece = piece.slice(1);
				flush();
				continue;
			}
			currentWords.push({
				text: piece.slice(0, boundary),
				color: word.color,
				bold: word.bold,
			});
			flush();
			piece = piece.slice(boundary).trim();
			if (!piece) break;
		}
		if (piece) currentWords.push({ text: piece, color: word.color, bold: word.bold });
	});
	flush();
	return outputLines.length ? outputLines : [[{ text: "", color: null, bold: false }]];
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
