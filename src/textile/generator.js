import { environmentFields, toNonEmptyTrimmedLines } from "../core/state.js";

export function ensureBlockContents(blockData) {
	if (!Array.isArray(blockData.contents))
		blockData.contents = blockData.content ? [String(blockData.content)] : [""];
	if (!blockData.contents.length) blockData.contents.push("");
	blockData.content = blockData.contents.join("\n");
}

function addH3(outputLines, title) {
	outputLines.push("h3. " + title, "");
}

function status(executionStatus) {
	return executionStatus === "PASS"
		? "%{color:green}PASS%"
		: executionStatus === "FAILED"
			? "%{color:red}FAILED%"
			: executionStatus === "WIP"
				? "%{color:orange}WIP%"
				: "N/A";
}

function cleanInlineListLine(lineText) {
	return String(lineText ?? "")
		.trim()
		.replace(/^[*#]+\s+/, "")
		.replace(/^\d+[.)]\s+/, "");
}

function labeledTextileLines(label, value) {
	const formattedLines = String(value ?? "")
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.split("\n")
		.map(cleanInlineListLine)
		.filter(Boolean);
	if (!formattedLines.length) return [];
	if (formattedLines.length === 1) return [`${label}: ${formattedLines[0]}`];
	return [`${label}:`, ...formattedLines.map((lineText) => `# ${lineText}`)];
}

function cleanEnvListLine(lineText) {
	const input = String(lineText ?? "");
	const trimmed = input.trim();
	const noStarHash = trimmed.replace(/^[*#]+\s+/, "");
	const noNumber = noStarHash.replace(/^\d+[.)]\s+/, "");
	return noNumber;
}

function envTextileLines(label, value) {
	const raw = String(value ?? "");
	const formattedLines = raw
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map(cleanEnvListLine)
		.filter(Boolean);
	let result;

	if (!formattedLines.length) {
		result = [];
	} else if (formattedLines.length === 1) {
		result = ["* " + label + ": " + formattedLines[0]];
	} else {
		result = ["* " + label + ":", ...formattedLines.map((lineText) => "*# " + lineText)];
	}
	return result;
}

export function textile(state) {
	const outputLines = [];
	outputLines.push("h2. " + (state.title || ""));

	if (state.relatedRef) {
		outputLines.push("", state.relatedRef);
	}

	outputLines.push("");
	if (state.status !== "N/A") {
		addH3(outputLines, "結論");
		outputLines.push("執行狀態: " + status(state.status));
	}
	const summaryLines = toNonEmptyTrimmedLines(state.summary);
	summaryLines.forEach((summaryLine) => outputLines.push("* " + summaryLine));
	const change = String(state.changeContent ?? "").trim();
	if (change) {
		outputLines.push("");
		addH3(outputLines, "修改目標");


		if (change === "X") {
			outputLines.push("修改內容: X");
		} else {
			outputLines.push(...labeledTextileLines("修改內容", state.changeContent));
		}

		outputLines.push("");
	} else {
		outputLines.push("");
	}
	const environmentLines = environmentFields.flatMap(([fieldKey, fieldLabel]) =>
		envTextileLines(fieldLabel, state.environment?.[fieldKey]),
	);
	if (environmentLines.length) {
		addH3(outputLines, "測試環境");
		outputLines.push(...environmentLines, "");
	}
	state.sections
		.filter((section) => section.enabled)
		.forEach((section) => {
			addH3(outputLines, section.title);
			if ((section.description || "").trim()) {
				outputLines.push(section.description, "");
			}
			(section.blocks || []).forEach((blockData) => push(outputLines, blockData));
			outputLines.push("");
		});

	const result =
		outputLines
			.join("\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim() + "\n";
	return applyPreCodeWorkarounds(result);
}

function blockLevel(blockData) {
	const raw = Number(blockData?.level || 1);
	return Math.max(1, Number.isFinite(raw) ? Math.floor(raw) : 1);
}

function blockMarker(blockData) {
	return "#".repeat(blockLevel(blockData)) + " ";
}

function pushPlainText(outputLines, blockData, content) {
	const marker = blockMarker(blockData);
	const rawLines = String(content || "")
		.replace(/\r\n?/g, "\n")
		.split("\n");
	if (blockLevel(blockData) <= 1) {
		outputLines.push(content);
		return;
	}
	let firstTextLine = true;
	rawLines.forEach((line) => {
		if (firstTextLine && line.trim()) {
			outputLines.push(marker + line);
			firstTextLine = false;
		} else {
			outputLines.push(line);
		}
	});
}

function codeContentForTextile(content, codeLang) {
	const lang = String(codeLang || "").trim();
	const codeOpen = '<code' + (lang ? ' class="' + lang + '"' : '') + '>';
	return String(content ?? "").replace(
		/%\{color:([^}]+)\}([\s\S]*?)%/g,
		(fullMatch, color, body) => `</code>%{color:${color}}${body}%${codeOpen} `,
	);
}

function push(outputLines, blockData) {
	ensureBlockContents(blockData);
	const marker = blockMarker(blockData);
	const title = (blockData.title || "").trim(),
		contents = blockData.contents.filter((contentItem) => String(contentItem || "").trim());
	if (blockData.type === "implementation") {
		outputLines.push(marker + (title || "api.c"));
		if (blockData.showWorkPath !== false) {
			outputLines.push(
				" {{collapse(" + (blockData.workPathTitle || "work path") + ")",
				'<pre><code class="shell">',
				blockData.workPath || "(docker)$ pwd",
				"</code></pre>",
				"}}",
			);
		}
		if ((blockData.description || "").trim()) outputLines.push(blockData.description);
		(contents.length ? contents : [""]).forEach((contentItem) => {
			const codeLang = blockData.codeLang || "cpp";
			outputLines.push(
				' <pre><code class="' + codeLang + '">',
				codeContentForTextile(contentItem, codeLang),
				"</code></pre>",
			);
		});
		return;
	}
	if (title && !["image", "plainText"].includes(blockData.type)) outputLines.push(marker + title);
	if (blockData.type === "plainText") {
		(contents.length ? contents : [""]).forEach((contentItem) => pushPlainText(outputLines, blockData, contentItem));
	} else if (["command", "diff", "log"].includes(blockData.type))
		contents.forEach((contentItem) => {
			const codeLang = blockData.type === "command" ? "shell" : blockData.type;
			const content =
				blockData.type === "command" ? codeContentForTextile(contentItem, codeLang) : contentItem;
			outputLines.push(
				' <pre><code class="' + codeLang + '">',
				content + "</code></pre>",
			);
		});
	else if (blockData.type === "mermaid")
		contents.forEach((contentItem) => outputLines.push(" {{mermaid", contentItem, "}}"));
	else if (blockData.type === "image")
		contents.forEach((contentItem) =>
			toNonEmptyTrimmedLines(contentItem).forEach((imageUrl) => outputLines.push("!" + imageUrl.replace(/^!|!$/g, "") + "!")),
		);
	else if (blockData.type === "collapse")
		contents.forEach((contentItem, contentIndex) =>
			outputLines.push(
				" {{collapse(" +
					(title || "detail") +
					(contents.length > 1 ? ` #${contentIndex + 1}` : "") +
					")",
				contentItem,
				"}}",
			),
		);
	else
		contents.forEach((contentItem) => {
			if (!title && blockLevel(blockData) > 1) pushPlainText(outputLines, blockData, contentItem);
			else outputLines.push(contentItem);
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
