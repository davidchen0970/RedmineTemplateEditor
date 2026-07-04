import { envKeys, esc, lines } from "./state.js";

export function ensureBlockContents(b) {
	if (!Array.isArray(b.contents))
		b.contents = b.content ? [String(b.content)] : [""];
	if (!b.contents.length) b.contents.push("");
	b.content = b.contents.join("\n");
}

function addH3(o, title) {
	o.push("h3. " + title, "");
}

function status(s) {
	return s === "PASS"
		? "%{color:green}PASS%"
		: s === "FAILED"
			? "%{color:red}FAILED%"
			: s === "WIP"
				? "%{color:orange}WIP%"
				: "N/A";
}

function cleanInlineListLine(s) {
	return String(s ?? "")
		.trim()
		.replace(/^[*#]+\s+/, "")
		.replace(/^\d+[.)]\s+/, "");
}

function labeledTextileLines(label, value) {
	const xs = String(value ?? "")
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.split("\n")
		.map(cleanInlineListLine)
		.filter(Boolean);
	if (!xs.length) return [];
	if (xs.length === 1) return [`${label}: ${xs[0]}`];
	return [`${label}:`, ...xs.map((x) => `# ${x}`)];
}

function cleanEnvListLine(s) {
	const input = String(s ?? "");
	const trimmed = input.trim();
	const noStarHash = trimmed.replace(/^[*#]+\s+/, "");
	const noNumber = noStarHash.replace(/^\d+[.)]\s+/, "");
	return noNumber;
}

function envTextileLines(label, value) {
	const raw = String(value ?? "");
	const xs = raw
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map(cleanEnvListLine)
		.filter(Boolean);
	let result;

	if (!xs.length) {
		result = [];
	} else if (xs.length === 1) {
		result = ["* " + label + ": " + xs[0]];
	} else {
		result = ["* " + label + ":", ...xs.map((x) => "*# " + x)];
	}
	return result;
}

export function textile(state) {
	const o = [];
	o.push("h2. " + (state.title || ""));

	if (state.relatedRef) {
		o.push("", state.relatedRef);
	}

	o.push("");
	if (state.status !== "N/A") {
		addH3(o, "結論");
		o.push("執行狀態: " + status(state.status));
	}
	const summaryLines = lines(state.summary);
	summaryLines.forEach((x) => o.push("* " + x));
	const change = String(state.changeContent ?? "").trim();
	if (change) {
		o.push("");
		addH3(o, "修改目標");

		const changeLine = change === "X" ? "修改內容: X" : "修改內容:";

		if (change === "X") {
			o.push("修改內容: X");
		} else {
			o.push(...labeledTextileLines("修改內容", state.changeContent));
		}

		o.push("");
	} else {
		o.push("");
	}
	const env = envKeys
		.map(([k, l]) => {
			const v = String(state.environment?.[k] ?? "").trim();
			const line = v ? `* ${l}: ${v}` : "";
			return line;
		})
		.filter(Boolean);
	const environmentLines = envKeys.flatMap(([k, l]) =>
		envTextileLines(l, state.environment?.[k]),
	);
	if (environmentLines.length) {
		addH3(o, "測試環境");
		o.push(...environmentLines, "");
	}
	state.sections
		.filter((s) => s.enabled)
		.forEach((s, i) => {
			addH3(o, s.title);
			if ((s.description || "").trim()) {
				o.push(s.description, "");
			}
			(s.blocks || []).forEach((b) => push(o, b));
			o.push("");
		});

	const result =
		o
			.join("\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim() + "\n";
	return result;
}

function blockLevel(b) {
	const raw = Number(b?.level || 1);
	return Math.max(1, Number.isFinite(raw) ? Math.floor(raw) : 1);
}

function blockMarker(b) {
	return "#".repeat(blockLevel(b)) + " ";
}

function pushPlainText(o, b, content) {
	const marker = blockMarker(b);
	const rawLines = String(content || "")
		.replace(/\r\n?/g, "\n")
		.split("\n");
	if (blockLevel(b) <= 1) {
		o.push(content);
		return;
	}
	let firstTextLine = true;
	rawLines.forEach((line) => {
		if (firstTextLine && line.trim()) {
			o.push(marker + line);
			firstTextLine = false;
		} else {
			o.push(line);
		}
	});
}

function codeContentForTextile(content, codeLang) {
	const lang = String(codeLang || "").trim();
	const codeOpen = '<code' + (lang ? ' class="' + lang + '"' : '') + '>';
	return String(content ?? "").replace(
		/%\{color:([^}]+)\}([\s\S]*?)%/g,
		(_, color, body) => `</code>%{color:${color}}${body}%${codeOpen} `,
	);
}

function push(o, b) {
	ensureBlockContents(b);
	const marker = blockMarker(b);
	const title = (b.title || "").trim(),
		contents = b.contents.filter((x) => String(x || "").trim());
	if (b.type === "implementation") {
		o.push(marker + (title || "api.c"));
		if (b.showWorkPath !== false) {
			o.push(
				" {{collapse(" + (b.workPathTitle || "work path") + ")",
				'<pre><code class="shell">',
				b.workPath || "(docker)$ pwd",
				"</code></pre>",
				"}}",
			);
		}
		if ((b.description || "").trim()) o.push(b.description);
		(contents.length ? contents : [""]).forEach((c) => {
			const codeLang = b.codeLang || "cpp";
			o.push(
				' <pre><code class="' + codeLang + '">',
				codeContentForTextile(c, codeLang),
				"</code></pre>",
			);
		});
		return;
	}
	if (title && !["image", "plainText"].includes(b.type)) o.push(marker + title);
	if (b.type === "plainText") {
		(contents.length ? contents : [""]).forEach((c) => pushPlainText(o, b, c));
	} else if (["command", "diff", "log"].includes(b.type))
		contents.forEach((c) => {
			const codeLang = b.type === "command" ? "shell" : b.type;
			const content =
				b.type === "command" ? codeContentForTextile(c, codeLang) : c;
			o.push(
				' <pre><code class="' + codeLang + '">',
				content + "</code></pre>",
			);
		});
	else if (b.type === "mermaid")
		contents.forEach((c) => o.push(" {{mermaid", c, "}}"));
	else if (b.type === "image")
		contents.forEach((c) =>
			lines(c).forEach((x) => o.push("!" + x.replace(/^!|!$/g, "") + "!")),
		);
	else if (b.type === "collapse")
		contents.forEach((c, i) =>
			o.push(
				" {{collapse(" +
					(title || "detail") +
					(contents.length > 1 ? ` #${i + 1}` : "") +
					")",
				c,
				"}}",
			),
		);
	else
		contents.forEach((c) => {
			if (!title && blockLevel(b) > 1) pushPlainText(o, b, c);
			else o.push(c);
		});
}

export function renderInlineTextile(s) {
	let t = esc(s);
	const inlineCodes = [];
	t = t.replace(/@([^@]+)@/g, (_, code) => {
		const key = `@@INLINE_CODE_${inlineCodes.length}@@`;
		inlineCodes.push(`<code>${code}</code>`);
		return key;
	});
	t = t
		.replace(/%\{color:([^}]+)\}([^%]+)%/g, '<span style="color:$1">$2</span>')
		.replace(/\*([^*\n]+?)\*/g, "<strong>$1</strong>")
		.replace(
			/&quot;([^&\n]*)&quot;:(https?:\/\/[^\s<]+)/g,
			(_, label, url) =>
				`<a href="${url}" target="_blank" rel="noopener noreferrer">${label || url}</a>`,
		);
	inlineCodes.forEach((html, index) => {
		t = t.replace(`@@INLINE_CODE_${index}@@`, html);
	});
	return t;
}

function escapePreviewHtml(s) {
	return esc(s);
}

function parsePreviewTableRow(trimmed) {
	const cells = trimmed
		.slice(1, -1)
		.split("|")
		.map((cell) => cell.trim());
	const hasHeaderCell = cells.some((cell) => cell.startsWith("_."));
	return (
		"<tr>" +
		cells
			.map((cell) => {
				const isHeader = cell.startsWith("_.");
				const clean = isHeader ? cell.replace(/^_\.\s*/, "") : cell;
				const tag = isHeader || hasHeaderCell ? "th" : "td";
				return "<" + tag + ">" + renderInlineTextile(clean) + "</" + tag + ">";
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
		const wanted = marker.split("").map((x) => (x === "*" ? "ul" : "ol"));
		let common = 0;
		while (
			common < listStack.length &&
			common < wanted.length &&
			listStack[common] === wanted[common]
		) {
			common++;
		}
		closeList(common);
		for (let i = common; i < wanted.length; i++) {
			html.push(openListTag(wanted[i]));
			listStack.push(wanted[i]);
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
	};
	const closeFlowBlocks = () => {
		closeList();
		closeTable();
	};
	const decodePreviewHtml = (s) =>
		String(s ?? "")
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
		if (isCode) {
			html.push(
				`<pre><code${lang ? ` class="${esc(lang)}"` : ""}>${escapePreviewHtml(content)}</code></pre>`,
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
		if (inPreCode) {
			html.push(
				`<pre><code${preLang ? ` class="${esc(preLang)}"` : ""}>${escapePreviewHtml(preContent)}</code></pre>`,
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
	for (const rawLine of inputLines) {
		const trimmed = rawLine.trim();
		if (inPre) {
			const decodedTrimmed = decodePreviewHtml(trimmed).trim();
			if (
				(inPreCode && decodedTrimmed === "</code></pre>") ||
				decodedTrimmed === "</pre>"
			) {
				flushPre();
			} else {
				preLines.push(rawLine);
			}
			continue;
		}
		if (inMermaid) {
			if (trimmed === "}}") {
				closeTable();
				flushMermaid();
			} else mermaidLines.push(rawLine);
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
			html.push(
				`<pre><code${inlinePreCodeMatch[1] ? ` class="${esc(inlinePreCodeMatch[1])}"` : ""}>${escapePreviewHtml(inlinePreCodeMatch[2])}</code></pre>`,
			);
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
		if (/^\|.+\|$/.test(trimmed)) {
			closeList();
			if (!inTable) {
				html.push('<table class="preview-table">');
				inTable = true;
			}
			html.push(parsePreviewTableRow(trimmed));
			continue;
		}
		if (/^h2\.\s+/.test(trimmed)) {
			closeFlowBlocks();
			html.push(
				`<h2>${renderInlineTextile(trimmed.replace(/^h2\.\s+/, ""))}</h2>`,
			);
			continue;
		}
		if (/^h3\.\s+/.test(trimmed)) {
			closeFlowBlocks();
			html.push(
				`<h3>${renderInlineTextile(trimmed.replace(/^h3\.\s+/, ""))}</h3>`,
			);
			continue;
		}
		const listMatch = trimmed.match(/^([*#]+)\s+(.+)$/);
		if (listMatch) {
			closeTable();
			addListItem(listMatch[1], listMatch[2]);
			continue;
		}
		const imageMatch = trimmed.match(/^!(.+)!$/);
		if (imageMatch) {
			closeTable();
			html.push(
				`<img src="${esc(imageMatch[1])}" alt="Redmine image preview">`,
			);
			continue;
		}
		if (listStack.length) closeTable();
		else closeFlowBlocks();
		html.push(`<p>${renderInlineTextile(trimmed)}</p>`);
	}
	if (inPre) flushPre();
	if (inMermaid) flushMermaid();
	if (inCollapse) flushCollapse();
	closeFlowBlocks();
	return html.join("\n") || '<p class="note">尚無可預覽內容</p>';
}
