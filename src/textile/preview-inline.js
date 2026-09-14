import { escapeHtml } from "../core/state.js";
import { normalizePreviewCssStyle, renderPreviewTextileStyleSpans } from "./preview-style.js";

const pendingPreviewImages = new Map();
export function registerPreviewImage(name, dataUrl) {
	if (name && dataUrl) pendingPreviewImages.set(name, dataUrl);
}
export function getPreviewImage(name) {
	return name ? pendingPreviewImages.get(name) : undefined;
}

export function renderPreviewImage(name) {
	const cleanName = String(name ?? "").trim();
	if (!cleanName) return "";
	const dataUrl = getPreviewImage(cleanName);
	return `<img class="preview-image" data-preview-name="${escapeHtml(cleanName)}" src="${escapeHtml(dataUrl || cleanName)}" alt="${escapeHtml(cleanName)}">`;
}

export function renderInlineTextile(text) {
	let renderedText = escapeHtml(text);
	const inlineCodes = [];
	renderedText = renderedText.replace(/@([^@]+)@/g, (fullMatch, code) => {
		const key = `@@INLINE_CODE_${inlineCodes.length}@@`;
		inlineCodes.push(`<code>${code}</code>`);
		return key;
	});
	renderedText = renderPreviewTextileStyleSpans(renderedText)
		.replace(/!\s*([^!]+?)\s*!/g, (fullMatch, name) => renderPreviewImage(name))
		.replace(/\*([^*\n]+?)\*/g, "<strong>$1</strong>")
		.replace(
			/&quot;([^&\n]*)&quot;:(https?:\/\/[^\s<]+)/g,
			(fullMatch, label, url) =>
				`<a href="${url}" target="_blank" rel="noopener noreferrer">${label || url}</a>`,
		);
	inlineCodes.forEach((html, index) => {
		renderedText = renderedText.replace(`@@INLINE_CODE_${index}@@`, html);
	});
	return renderedText;
}

export function escapePreviewHtml(text) {
	return escapeHtml(text);
}

export function renderPreviewCodeHtml(content) {
	const cleaned = String(content)
		.replace(/<\/code>\s?/gi, "")
		.replace(/<code\b[^>]*>\s?/gi, "");
	return renderPreviewTextileStyleSpans(escapePreviewHtml(cleaned));
}

export function renderDiffPreview(content) {
	let oldLine = null;
	let newLine = null;
	const rows = String(content ?? "").split("\n").map((line) => {
		let type = "context";
		let oldNumber = "";
		let newNumber = "";
		const hunk = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);

		if (hunk) {
			type = "hunk";
			oldLine = Number(hunk[1]);
			newLine = Number(hunk[2]);
		} else if (/^(diff --git|index |--- |\+\+\+ |new file mode |deleted file mode |similarity index |rename (from|to) )/.test(line)) {
			type = "meta";
		} else if (line.startsWith("+") && !line.startsWith("+++")) {
			type = "added";
			newNumber = newLine ?? "";
			if (newLine !== null) newLine++;
		} else if (line.startsWith("-") && !line.startsWith("---")) {
			type = "removed";
			oldNumber = oldLine ?? "";
			if (oldLine !== null) oldLine++;
		} else if (line.startsWith("\ No newline at end of file")) {
			type = "notice";
		} else {
			oldNumber = oldLine ?? "";
			newNumber = newLine ?? "";
			if (oldLine !== null) oldLine++;
			if (newLine !== null) newLine++;
		}

		return `<span class="diff-line diff-${type}"><span class="diff-line-number diff-old">${oldNumber}</span><span class="diff-line-number diff-new">${newNumber}</span><span class="diff-code">${escapePreviewHtml(line) || " "}</span></span>`;
	});

	return `<div class="diff-preview" role="region" aria-label="Diff preview"><div class="diff-toolbar"><strong>DIFF</strong></div><pre><code class="diff">${rows.join("\n")}</code></pre></div>`;
}

// Parse the optional table-cell control head that precedes the content.
// Order (fixed by Redmine/Textile): _ highlight, \n colspan, /n rowspan,
// < = > horizontal align, ^ - ~ vertical align, {css} style, terminated by ".".
export function parseTableCellHead(cell) {
	const defaults = {
		highlight: false,
		colspan: "",
		rowspan: "",
		align: "",
		valign: "",
		attr: "",
		body: cell
	};
	const match = cell.match(
		/^(?<highlight>_)?(?:(?<colspan>\\\d+)|(?<rowspan>\/\d+))?(?<align><|=|>)?(?<valign>\^|~|-)?(?<attr>\{[^{}\n]*\})?\.\s*(?<body>[\s\S]*)$/,
	);
	if (!match) return defaults;
	return {
		highlight: Boolean(match.groups.highlight),
		colspan: (match.groups.colspan || "").replace("\\", ""),
		rowspan: (match.groups.rowspan || "").replace("/", ""),
		align: match.groups.align || "",
		valign: match.groups.valign || "",
		attr: match.groups.attr || "",
		body: match.groups.body || ""
	};
}

export function parseTableCellStyle(head) {
	const declarations = [];
	if (head.attr) {
		const inner = head.attr.slice(1, -1);
		if (inner.trim()) declarations.push(inner);
	}
	if (head.align === "<") declarations.push("text-align:left");
	else if (head.align === "=") declarations.push("text-align:center");
	else if (head.align === ">") declarations.push("text-align:right");
	if (head.valign === "^") declarations.push("vertical-align:top");
	else if (head.valign === "-") declarations.push("vertical-align:middle");
	else if (head.valign === "~") declarations.push("vertical-align:bottom");
	return normalizePreviewCssStyle(declarations.join(";"));
}

export function parsePreviewTableRow(trimmed) {
	const cells = trimmed
		.slice(1, -1)
		.split("|")
		.map((cell) => cell.trim())
		.map(parseTableCellHead);
	const hasHeaderCell = cells.some((head) => head.highlight);
	return (
		"<tr>" +
		cells
			.map((head) => {
				const tag = head.highlight || hasHeaderCell ? "th" : "td";
				const style = parseTableCellStyle(head);
				const attributes =
					(style ? ` style="${style}"` : "") +
					(head.colspan ? ` colspan="${head.colspan}"` : "") +
					(head.rowspan ? ` rowspan="${head.rowspan}"` : "");
				return `<${tag}${attributes}>${renderInlineTextile(head.body)}</${tag}>`;
			})
			.join("") +
		"</tr>"
	);
}
