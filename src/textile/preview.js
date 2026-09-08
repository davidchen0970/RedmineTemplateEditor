import { escapeHtml } from "../core/state.js";

const pendingPreviewImages = new Map();
export function registerPreviewImage(name, dataUrl) {
	if (name && dataUrl) pendingPreviewImages.set(name, dataUrl);
}
export function getPreviewImage(name) {
	return name ? pendingPreviewImages.get(name) : undefined;
}

function normalizePreviewCssColor(value) {
	return String(value ?? "")
		.trim()
		.replace(/[^#(),.%\w\s-]/g, "");
}

// Combine arbitrary CSS declarations (e.g. "background:yellow; color:red")
// into a safe inline style string for preview rendering.
function normalizePreviewCssStyle(rawStyle) {
	return String(rawStyle ?? "")
		.split(";")
		.map((declaration) => declaration.trim())
		.filter(Boolean)
		.map((declaration) => {
			const separator = declaration.indexOf(":");
			if (separator < 1) return "";
			const property = declaration.slice(0, separator).trim();
			const value = declaration.slice(separator + 1).trim();
			if (!/^[a-zA-Z-]+$/.test(property)) return "";
			const safeValue = normalizePreviewCssColor(value);
			if (!safeValue) return "";
			return `${property}:${safeValue}`;
		})
		.filter(Boolean)
		.join("; ");
}

function renderPreviewTextileStyleSpans(text) {
	let previous;
	const spanPattern = /%\{([^}]+)\}([^%]+)%/g;

	// Run repeatedly so nested spans produced by text-color-menu.js and
	// text-background-menu.js can both render in preview.
	do {
		previous = text;
		text = text.replace(spanPattern, (fullMatch, rawStyle, body) => {
			const style = normalizePreviewCssStyle(rawStyle);
			if (!style) return body;
			return `<span style="${style}">${body}</span>`;
		});
	} while (text !== previous);

	return text;
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

function escapePreviewHtml(text) {
	return escapeHtml(text);
}

function renderPreviewCodeHtml(content) {
	const cleaned = String(content)
		.replace(/<\/code>\s?/gi, "")
		.replace(/<code\b[^>]*>\s?/gi, "");
	let text = escapePreviewHtml(cleaned);
	const pattern = /%\{([^}]+)\}([^%]+)%/g;
	let previous;
	do {
		previous = text;
		text = text.replace(pattern, (fullMatch, rawStyle, body) => {
			const style = normalizePreviewCssStyle(rawStyle);
			if (!style) return body;
			return `<span style="${style}">${body}</span>`;
		});
	} while (text !== previous);
	return text;
}

function renderDiffPreview(content) {
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
function parseTableCellHead(cell) {
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

function parseTableCellStyle(head) {
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

function parsePreviewTableRow(trimmed) {
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

export function textileToPreviewHtml(text) {
	const inputLines = String(text ?? "")
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.split("\n");
	const html = [];
	let listStack = [],
		listItemOpen = [],
		inTable = false,
		expectTable = false,
		pendingTableStyle = "",
		tableListDepth = 0,
		inPre = false,
		inPreCode = false,  
		preLang = "",
		preLines = [],
		inCollapse = false,
		collapseTitle = "detail",
		collapseLines = [],
		inMermaid = false,
		mermaidLines = [];
	const closeListItem = (level) => {
		if (!listItemOpen[level]) return;
		html.push("</li>");
		listItemOpen[level] = false;
	};
	const closeList = (level = 0) => {
		while (listStack.length > level) {
			const currentLevel = listStack.length - 1;
			closeListItem(currentLevel);
			html.push(listStack.pop() === "ul" ? "</ul>" : "</ol>");
			listItemOpen.pop();
		}
	};
	const openListTag = (type) => (type === "ol" ? "<ol>" : "<ul>");
	const syncList = (marker) => {
		const wanted = marker.split("").map((markerCharacter) => (markerCharacter === "*" ? "ul" : "ol"));
		let common = 0;
		while (
			common < listStack.length &&
			common < wanted.length &&
			listStack[common] === wanted[common]
		) {
			common++;
		}
		closeList(common);
		for (let listLevel = common; listLevel < wanted.length; listLevel++) {
			html.push(openListTag(wanted[listLevel]));
			listStack.push(wanted[listLevel]);
			listItemOpen.push(false);
		}
	};
	const addListItem = (marker, body) => {
		syncList(marker);
		const level = marker.length - 1;
		closeListItem(level);
		html.push(`<li>${renderInlineTextile(body)}`);
		listItemOpen[level] = true;
	};
	const closeTable = () => {
		if (!inTable) return;
		html.push("</table>");
		inTable = false;
		// If the table was nested inside a list (rendered indented under the
		// surrounding #/## heading), close that list now so following blocks
		// return to the top level.
		if (tableListDepth > 0) {
			closeList();
			tableListDepth = 0;
		}
	};
	const closeFlowBlocks = () => {
		closeTable();
		closeList();
	};
	const resetTableAttr = () => {
		expectTable = false;
		pendingTableStyle = "";
	};
	const decodePreviewHtml = (text) =>
		String(text ?? "")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&amp;/g, "&");
	const pushInlineParagraph = (text) => {
		const body = String(text ?? "").trim();
		if (!body) return;
		closeFlowBlocks();
		html.push(`<p>${renderInlineTextile(body)}</p>`);
	};
	const pushPreBlock = (content, lang = "", isCode = false) => {
		closeFlowBlocks();
		if (isCode && String(lang).toLowerCase() === "diff") {
			html.push(renderDiffPreview(content));
		} else if (isCode) {
			html.push(
				`<pre><code${lang ? ` class="${escapeHtml(lang)}"` : ""}>${renderPreviewCodeHtml(content)}</code></pre>`,
			);
		} else {
			html.push(`<pre>${renderInlineTextile(content)}</pre>`);
		}
	};
	const processInlinePreSegments = (line) => {
		const decodedLine = decodePreviewHtml(line);
		const prePattern = /<pre><code(?: class=["']?([^"'>]+)["']?)?>([\s\S]*?)<\/code><\/pre>|<pre>([\s\S]*?)<\/pre>/gi;
		let lastIndex = 0;
		let matched = false;
		let match;
		while ((match = prePattern.exec(decodedLine))) {
			matched = true;
			pushInlineParagraph(decodedLine.slice(lastIndex, match.index));
			if (match[2] !== undefined) {
				pushPreBlock(match[2], match[1] || "", true);
			} else {
				pushPreBlock(match[3] || "", "", false);
			}
			lastIndex = prePattern.lastIndex;
		}
		if (!matched) return false;
		pushInlineParagraph(decodedLine.slice(lastIndex));
		return true;
	};
	const flushPre = () => {
		const preContent = preLines.join("\n");
		if (inPreCode && String(preLang).toLowerCase() === "diff") {
			html.push(renderDiffPreview(preContent));
		} else if (inPreCode) {
			html.push(
				`<pre><code${preLang ? ` class="${escapeHtml(preLang)}"` : ""}>${renderPreviewCodeHtml(preContent)}</code></pre>`,
			);
		} else {
			html.push(`<pre>${renderInlineTextile(preContent)}</pre>`);
		}
		inPre = false;
		inPreCode = false;
		preLang = "";
		preLines = [];
	};
	const flushMermaid = () => {
		html.push(
			'<div class="mermaid">' +
				escapePreviewHtml(mermaidLines.join("\n")) +
				"</div>",
		);

		inMermaid = false;
		mermaidLines = [];
	};
	const flushCollapse = () => {
		const collapseBody = textileToPreviewHtml(collapseLines.join("\n"));
		html.push(
			"<details><summary>" +
				renderInlineTextile(collapseTitle) +
				'</summary><div class="preview-collapse-body">' +
				collapseBody +
				"</div></details>",
		);
		inCollapse = false;
		collapseTitle = "detail";
		collapseLines = [];
	};
	for (let lineIndex = 0; lineIndex < inputLines.length; lineIndex++) {
		const rawLine = inputLines[lineIndex];
		const trimmed = rawLine.trim();
		
		if (inPre) {
			const decodedLine = decodePreviewHtml(rawLine);
			const closePattern = inPreCode
				? /<\/code>\s*<\/pre>/i
				: /<\/pre>/i;
			const closeMatch = closePattern.exec(decodedLine);

			if (!closeMatch) {
				preLines.push(rawLine);
				continue;
			}

			const beforeClosing = rawLine.slice(0, closeMatch.index);
			if (beforeClosing) {
				preLines.push(beforeClosing);
			}

			flushPre();

			const afterClosingIndex = closeMatch.index + closeMatch[0].length;
			const afterClosing = rawLine.slice(afterClosingIndex);
			if (afterClosing.trim()) {
				inputLines.splice(lineIndex + 1, 0, afterClosing);
			}

			continue;
		}
		if (inCollapse) {
			if (trimmed === "}}") {
				closeTable();
				flushCollapse();
			} else collapseLines.push(rawLine);
			continue;
		}
		if (!trimmed) {
			closeFlowBlocks();
			resetTableAttr();
			continue;
		}
		const decodedTrimmed = decodePreviewHtml(trimmed).trim();
		if (/<pre>/i.test(decodedTrimmed) && processInlinePreSegments(rawLine)) {
			continue;
		}
		const inlinePreCodeMatch = decodedTrimmed.match(
			/^<pre><code(?: class=["']?([^"'>]+)["']?)?>([\s\S]*)<\/code><\/pre>$/i,
		);
		if (inlinePreCodeMatch) {
			closeTable();
			const [, rawLang, rawContent] = inlinePreCodeMatch;
			if (String(rawLang || "").toLowerCase() === "diff") {
				html.push(renderDiffPreview(rawContent));
			} else {
				const className = rawLang ? ` class="${escapeHtml(rawLang)}"` : "";
				const escapedContent = renderPreviewCodeHtml(rawContent);
				html.push(`<pre><code${className}>${escapedContent}</code></pre>`);
			}
			continue;
		}
		const inlinePreMatch = decodedTrimmed.match(/^<pre>([\s\S]*)<\/pre>$/i);
		if (inlinePreMatch) {
			closeTable();
			html.push(`<pre>${renderInlineTextile(inlinePreMatch[1])}</pre>`);
			continue;
		}
		const preCodeMatch = decodedTrimmed.match(
			/^<pre><code(?: class=["']?([^"'>]+)["']?)?>$/i,
		);
		if (preCodeMatch) {
			closeTable();
			inPre = true;
			inPreCode = true;
			preLang = preCodeMatch[1] || "";
			preLines = [];
			continue;
		}
		if (/^<pre>$/i.test(decodedTrimmed)) {
			closeTable();
			inPre = true;
			inPreCode = false;
			preLang = "";
			preLines = [];
			continue;
		}
		const collapseMatch = trimmed.match(/^\{\{collapse\((.*)\)$/);
		if (collapseMatch) {
			closeTable();
			inCollapse = true;
			collapseTitle = collapseMatch[1] || "detail";
			collapseLines = [];
			continue;
		}
		if (trimmed === "{{mermaid") {
			closeTable();
			inMermaid = true;
			mermaidLines = [];
			continue;
		}
		// table{...}. declares attributes for the immediately following table
		// (Redmine): e.g. table{margin-left:2em}. / table{width:100%}.
		const tableAttrMatch = trimmed.match(/^table\{([^{}\n]*)\}\.\s*$/);
		if (tableAttrMatch) {
			pendingTableStyle = tableAttrMatch[1];
			expectTable = true;
			continue;
		}
		if (/^\|.+\|$/.test(trimmed)) {
			if (!inTable) {
				const tableStyle = normalizePreviewCssStyle(expectTable ? pendingTableStyle : "");
				resetTableAttr();
				html.push(`<table class="preview-table"${tableStyle ? ` style="${tableStyle}"` : ""}>`);
				inTable = true;
				// Nest the table inside the current list level (indents it
				// under a preceding #/## heading) instead of closing the list.
				tableListDepth = listStack.length;
			}
			html.push(parsePreviewTableRow(trimmed));
			continue;
		}
		if (/^h2\.\s+/.test(trimmed)) {
			closeFlowBlocks();
			resetTableAttr();
			html.push(
				`<h2>${renderInlineTextile(trimmed.replace(/^h2\.\s+/, ""))}</h2>`,
			);
			continue;
		}
		if (/^h3\.\s+/.test(trimmed)) {
			closeFlowBlocks();
			resetTableAttr();
			html.push(
				`<h3>${renderInlineTextile(trimmed.replace(/^h3\.\s+/, ""))}</h3>`,
			);
			continue;
		}
		const listMatch = trimmed.match(/^([*#]+)\s+(.+)$/);
		if (listMatch) {
			closeTable();
			resetTableAttr();
			addListItem(listMatch[1], listMatch[2]);
			continue;
		}
		const imageMatch = trimmed.match(/^!(.+)!$/);
		if (imageMatch) {
			closeTable();
			resetTableAttr();
			html.push(renderPreviewImage(imageMatch[1]));
			continue;
		}
		if (listStack.length) closeTable();
		else closeFlowBlocks();
		resetTableAttr();
		html.push(`<p>${renderInlineTextile(trimmed)}</p>`);
	}
	if (inPre) flushPre();
	if (inMermaid) flushMermaid();
	if (inCollapse) flushCollapse();
	closeFlowBlocks();
	return html.join("\n") || '<p class="note">尚無可預覽內容</p>';
}
