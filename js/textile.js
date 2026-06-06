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

function push(o, b) {
	ensureBlockContents(b);
	const title = (b.title || "").trim(),
		contents = b.contents.filter((x) => String(x || "").trim());
	if (b.type === "implementation") {
		o.push("# " + (title || "api.c"));
		if (b.showWorkPath !== false) {
			o.push(
				"{{collapse(" + (b.workPathTitle || "work path") + ")",
				'<pre><code class="shell">',
				b.workPath || "(docker)$ pwd",
				"</code></pre>",
				"}}",
			);
		}
		if ((b.description || "").trim()) o.push(b.description);
		(contents.length ? contents : [""]).forEach((c) =>
			o.push(
				' <pre><code class="' + (b.codeLang || "cpp") + '">',
				c,
				"</code></pre>",
			),
		);
		return;
	}
	if (title && b.type !== "image") o.push("# " + title);
	if (["command", "diff", "log"].includes(b.type))
		contents.forEach((c) =>
			o.push(
				' <pre><code class="' +
					(b.type === "command" ? "shell" : b.type) +
					'">',
				c,
				"</code></pre>",
			),
		);
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
	else contents.forEach((c) => o.push(c));
}

export function renderInlineTextile(s) {
	let t = esc(s);
	t = t
		.replace(/%\{color:([^}]+)\}([^%]+)%/g, '<span style="color:$1">$2</span>')
		.replace(/@([^@]+)@/g, "<code>$1</code>")
		.replace(
			/"([^"]+)":(https?:\/\/[^\s]+)/g,
			'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
		);
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
		listCounters = {},
		inTable = false,
		inPre = false,
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
	const openListTag = (type, markerPrefix) => {
		if (type !== "ol") return "<ul>";
		const start = (listCounters[markerPrefix] || 0) + 1;
		return start > 1 ? `<ol start="${start}">` : "<ol>";
	};
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
			const markerPrefix = marker.slice(0, i + 1);
			html.push(openListTag(wanted[i], markerPrefix));
			listStack.push(wanted[i]);
			listItemOpen.push(false);
		}
	};
	const addListItem = (marker, body) => {
		syncList(marker);
		const level = marker.length - 1;
		closeListItem(level);
		if (marker.endsWith("#")) {
			listCounters[marker] = (listCounters[marker] || 0) + 1;
		}
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
	const flushPre = () => {
		html.push(
			`<pre><code${preLang ? ` class="${esc(preLang)}"` : ""}>${escapePreviewHtml(preLines.join("\n"))}</code></pre>`,
		);
		inPre = false;
		preLang = "";
		preLines = [];
	};
	const flushMermaid = () => {
		html.push(
			'<div class="preview-placeholder"><strong>Mermaid</strong><pre><code>' +
				escapePreviewHtml(mermaidLines.join("\n")) +
				"</code></pre></div>",
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
			if (decodedTrimmed === "</code></pre>" || decodedTrimmed === "</pre>")
				flushPre();
			else preLines.push(rawLine);
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
			closeTable();
			continue;
		}
		const decodedTrimmed = decodePreviewHtml(trimmed).trim();
		const inlinePreMatch = decodedTrimmed.match(
			/^<pre><code(?: class=["']?([^"'>]+)["']?)?>([\s\S]*)<\/code><\/pre>$/i,
		);
		if (inlinePreMatch) {
			closeTable();
			html.push(
				`<pre><code${inlinePreMatch[1] ? ` class="${esc(inlinePreMatch[1])}"` : ""}>${escapePreviewHtml(inlinePreMatch[2])}</code></pre>`,
			);
			continue;
		}
		const preMatch = decodedTrimmed.match(
			/^<pre><code(?: class=["']?([^"'>]+)["']?)?>$/i,
		);
		if (preMatch) {
			closeTable();
			inPre = true;
			preLang = preMatch[1] || "";
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
