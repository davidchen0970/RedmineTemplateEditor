import { envKeys, esc, lines } from "../core/state.js";

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
	return applyPreCodeWorkarounds(result);
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

function applyPreCodeWorkarounds(text) {
	return String(text ?? "")
		.replace(/\n[\t ]*(<\/code><\/pre>)/gi, "$1")
		.replace(
			/(<\/code><\/pre>)([\s\S]*?)(?=<pre><code(?:\s|>))/gi,
			(match, closeTag, between) => {
				if (/^[\x20\n\r]*$/.test(between)) {
					return closeTag;
				}
				return match;
			}
		);
}
