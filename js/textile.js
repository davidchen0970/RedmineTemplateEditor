/* Textile export and preview rendering helpers. */
function addH3(o, title) {
	o.push("h3. " + title);
	o.push("");
}
function textile() {
	const o = [];
	o.push("h2. " + (state.title || ""));
	if (state.relatedRef) {
		o.push("");
		o.push(state.relatedRef);
	}
	o.push("");
	if (state.status !== "N/A") {
		addH3(o, "結論");
		o.push("執行狀態: " + status(state.status));
	}
	lines(state.summary).forEach((x) => o.push("* " + x));
	const changeContent = String(state.changeContent ?? "").trim();
	if (changeContent) {
		o.push("");
		addH3(o, "修改目標");
		if (changeContent === "X") {
			o.push("修改內容: X");
		} else {
			o.push("修改內容:");
			o.push(state.changeContent || "");
		}
		o.push("");
	}
	else {
		o.push("");
	}

	const environmentLines = envKeys
		.map(([k, l]) => {
			const v = String(state.environment[k] ?? "").trim();
			return v ? "* " + l + ": " + v : "";
		})
		.filter(Boolean);
	if (environmentLines.length) {
		addH3(o, "測試環境");
		o.push(...environmentLines);
		o.push("");
	}
	state.sections
		.filter((s) => s.enabled)
		.forEach((s) => {
			addH3(o, s.title);
			if ((s.description || "").trim()) {
				o.push(s.description || "");
				o.push("");
			}
			(s.blocks || []).forEach((b) => push(o, b));
			o.push("");
		});
	return (
		o
			.join("\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim() + "\n"
	);
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
function push(o, b) {
	const title = (b.title || "").trim();
	const contents = getBlockContents(b).filter((x) => String(x || "").trim());
	if (b.type === "implementation") {
		o.push("# " + (title || "api.c"));
		if (b.showWorkPath !== false) {
			o.push("{{collapse(" + (b.workPathTitle || "work path") + ")");
			o.push('<pre><code class="shell">');
			o.push(b.workPath || "(docker)$ pwd");
			o.push("</code></pre>");
			o.push("}}");
		}
		if ((b.description || "").trim()) {
			o.push(b.description || "");
		}
		(contents.length ? contents : [""]).forEach((content) => {
			o.push(' <pre><code class="' + (b.codeLang || "cpp") + '">');
			o.push(content);
			o.push("</code></pre>");		});
		return;
	}
	if (title && b.type !== "image") o.push("# " + title);
	if (["command", "diff", "log"].includes(b.type)) {
		contents.forEach((content) => {
			if (["diff", "log"].includes(b.type))
				o.push(" <pre><code class=\"" + b.type + "\">");
			else
				o.push(" <pre><code class=\"shell\">");
			o.push(content);
			o.push("</code></pre>");
		});
	} else if (b.type === "mermaid") {
		contents.forEach((content) => {
			o.push(" {{mermaid");
			o.push(content);
			o.push("}}");
		});
	} else if (b.type === "image") {
		contents.forEach((content) => {
			lines(content).forEach((x) => o.push("!" + x.replace(/^!|!$/g, "") + "!"));
		});
	} else if (b.type === "collapse") {
		contents.forEach((content, index) => {
			const suffix = contents.length > 1 ? " #" + (index + 1) : "";
			o.push(" {{collapse(" + (title || "detail") + suffix + ")");
			o.push(content);
			o.push("}}");
		});
	} else {
		contents.forEach((content) => o.push(content));
	}
}

function escapePreviewHtml(s) {
	return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
function renderInlineTextile(s) {
	let text = escapePreviewHtml(s);
	text = text.replace(/%\{color:([^}]+)\}([^%]+)%/g, '<span style="color:$1">$2</span>');
	text = text.replace(/@([^@]+)@/g, '<code>$1</code>');
	text = text.replace(/"([^"]+)":(https?:\/\/[^\s]+)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
	return text;
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

function textileToPreviewHtml(text) {
	const inputLines = String(text ?? "")
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.split("\n");
	const html = [];
	let inList = null;
	let inTable = false;

	let inPre = false;
	let preLang = "";
	let preLines = [];

	let inCollapse = false;
	let collapseTitle = "detail";
	let collapseLines = [];

	let inMermaid = false;
	let mermaidLines = [];

	const closeList = () => {
		if (!inList) return;
		html.push("</" + inList + ">");
		inList = null;
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
	const flushPre = () => {
		html.push(
			"<pre><code" +
				(preLang ? ' class="' + escapePreviewHtml(preLang) + '"' : "") +
				">" +
				escapePreviewHtml(preLines.join("\n")) +
				"</code></pre>",
		);
		inPre = false;
		preLang = "";
		preLines = [];
	};
	const renderPlainBlock = (lines) => textileToPreviewHtml(lines.join("\n"));
	for (const rawLine of inputLines) {
		const trimmed = rawLine.trim();
		if (inPre) {
			if (trimmed === "</code></pre>" || trimmed === "</pre>") flushPre();
			else preLines.push(rawLine);
			continue;
		}
		if (inMermaid) {
			if (trimmed === "}}") {
				closeFlowBlocks();
				html.push(
					'<div class="preview-placeholder"><strong>Mermaid</strong><pre><code>' +
						escapePreviewHtml(mermaidLines.join("\n")) +
						"</code></pre></div>",
				);
				inMermaid = false;
				mermaidLines = [];
			} else mermaidLines.push(rawLine);
			continue;
		}
		if (inCollapse) {
			if (trimmed === "}}") {
				closeFlowBlocks();
				html.push(
					"<details><summary>" +
						renderInlineTextile(collapseTitle) +
						'</summary><div class="preview-collapse-body">' +
						renderPlainBlock(collapseLines) +
						"</div></details>",
				);
				inCollapse = false;
				collapseTitle = "detail";
				collapseLines = [];
			} else collapseLines.push(rawLine);
			continue;
		}
		if (!trimmed) {
			closeFlowBlocks();
			continue;
		}
		const inlinePreMatch = trimmed.match(
			/^<pre><code(?: class=["']?([^"'>]+)["']?)?>([\s\S]*)<\/code><\/pre>$/i,
		);

		if (inlinePreMatch) {
			closeFlowBlocks();
			html.push(
				"<pre><code" +
					(inlinePreMatch[1]
						? ' class="' + escapePreviewHtml(inlinePreMatch[1]) + '"'
						: "") +
					">" +
					escapePreviewHtml(inlinePreMatch[2]) +
					"</code></pre>",
			);
			continue;
		}

		const preMatch = trimmed.match(
			/^<pre><code(?: class=["']?([^"'>]+)["']?)?>$/i,
		);
		if (preMatch) {
			closeFlowBlocks();
			inPre = true;
			preLang = preMatch[1] || "";
			preLines = [];
			continue;
		}
		const collapseMatch = trimmed.match(/^\{\{collapse\((.*)\)$/);
		if (collapseMatch) {
			closeFlowBlocks();
			inCollapse = true;
			collapseTitle = collapseMatch[1] || "detail";
			collapseLines = [];
			continue;
		}
		if (trimmed === "{{mermaid") {
			closeFlowBlocks();
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
				"<h2>" + renderInlineTextile(trimmed.replace(/^h2\.\s+/, "")) + "</h2>",
			);
			continue;
		}
		if (/^h3\.\s+/.test(trimmed)) {
			closeFlowBlocks();
			html.push(
				"<h3>" + renderInlineTextile(trimmed.replace(/^h3\.\s+/, "")) + "</h3>",
			);
			continue;
		}
		if (/^\*\s+/.test(trimmed)) {
			closeTable();
			if (inList !== "ul") {
				closeList();
				html.push("<ul>");
				inList = "ul";
			}
			html.push(
				"<li>" + renderInlineTextile(trimmed.replace(/^\*\s+/, "")) + "</li>",
			);
			continue;
		}
		if (/^#\s+/.test(trimmed)) {
			closeTable();
			if (inList !== "ol") {
				closeList();
				html.push("<ol>");
				inList = "ol";
			}
			html.push(
				"<li>" + renderInlineTextile(trimmed.replace(/^#\s+/, "")) + "</li>",
			);
			continue;
		}
		const imageMatch = trimmed.match(/^!(.+)!$/);
		if (imageMatch) {
			closeFlowBlocks();
			html.push(
				'<img src="' +
					escapePreviewHtml(imageMatch[1]) +
					'" alt="Redmine image preview">',
			);
			continue;
		}
		closeFlowBlocks();
		html.push("<p>" + renderInlineTextile(trimmed) + "</p>");
	}
	if (inPre) flushPre();
	if (inMermaid)
		html.push(
			'<div class="preview-placeholder"><strong>Mermaid</strong><pre><code>' +
				escapePreviewHtml(mermaidLines.join("\n")) +
				"</code></pre></div>",
		);
	if (inCollapse)
		html.push(
			"<details><summary>" +
				renderInlineTextile(collapseTitle) +
				'</summary><div class="preview-collapse-body">' +
				renderPlainBlock(collapseLines) +
				"</div></details>",
		);
	closeFlowBlocks();
	return html.join("\n") || '<p class="note">尚無可預覽內容</p>';
}


