// Pure SVG-label helpers lifted out of the Mermaid PNG exporter so the label
// colour and wrapping logic can be unit-tested without a DOM or a canvas. The
// browser path measures real glyph widths via an off-screen <canvas>; when no
// canvas is available (e.g. under node), measurement falls back to a 0.58em-per
// char estimate, which keeps wrapLabelRuns deterministic and testable.

// Turn a normalized color ("red", "rgb(220,38,38)", "#abc", "#aabbcc", "rgba(…)")
// into something a plain SVG renderer reliably paints (#rrggbb or a named keyword),
// or null when there is no usable color.
export function resolveLabelColor(value) {
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

// Measure a word/line width with the same (loaded) font the label uses. Falls back
// to a rough 0.58em-per-char estimate if the browser has no canvas measureText.
export function measureLabelText(text, fontSize, fontFamily) {
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
export function wrapLabelRuns(runs, maxWidth, fontSize, fontFamily) {
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
