import { escapeHtml } from "../core/state.js";
import { normalizePreviewCssStyle } from "./preview-style.js";
import {
	renderInlineTextile,
	escapePreviewHtml,
	renderPreviewCodeHtml,
	renderDiffPreview,
	parsePreviewTableRow,
	renderPreviewImage,
} from "./preview-inline.js";

// Re-exported for callers that historically imported from preview.js.
export {
	registerPreviewImage,
	getPreviewImage,
	renderPreviewImage,
	renderInlineTextile,
} from "./preview-inline.js";

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
		const mermaidSource = mermaidLines.join("\n");
		html.push(
			'<div class="mermaid" data-mermaid-source="' +
				escapeHtml(mermaidSource) +
				'">' +
				escapePreviewHtml(mermaidSource) +
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
		if (inMermaid) {
			if (trimmed === "}}") {
				closeTable();
				flushMermaid();
			} else mermaidLines.push(rawLine);
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
