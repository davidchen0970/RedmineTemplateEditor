// Pure helpers: filter any CSS string (`background:yellow; color:red`) down to a safe inline style,
// and turn a `%{style}body%` textile style span into a <span style=...>.
export function normalizePreviewCssColor(value) {
	return String(value ?? "")
		.trim()
		.replace(/[^#(),.%\w\s-]/g, "");
}

export function normalizePreviewCssStyle(rawStyle) {
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

export function renderPreviewTextileStyleSpans(text) {
	let previous;
	const spanPattern = /%\{([^}]+)\}([^%]+)%/g;
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
