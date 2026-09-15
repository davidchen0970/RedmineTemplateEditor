// Shared helpers for managing Redmine Textile inline style spans of the form:
//   %{color:red; background:yellow}content%
// Multiple CSS declarations may be combined in one span (merged) so that the colour
// and background menus can edit a single property without losing the others.

export const COLOR_PROP = "color";
export const BACKGROUND_PROP = "background";

function parseStyleDeclaration(styleText) {
	const styles = {};
	String(styleText || "")
		.split(";")
		.forEach((part) => {
			const idx = part.indexOf(":");
			if (idx < 1) return;
			let prop = part.slice(0, idx).trim().toLowerCase();
			const val = part.slice(idx + 1).trim();
			if (!val) return;
			if (prop === "background-color") prop = BACKGROUND_PROP;
			styles[prop] = val;
		});
	return styles;
}

function serializeStyleDeclaration(styles) {
	return Object.entries(styles)
		.map(([prop, val]) => `${prop}:${val}`)
		.join("; ");
}

// Build a span string, omitting the %{...} wrapper when no declarations remain.
export function buildStyleSpan(innerStyleText, inner) {
	const style = String(innerStyleText ?? "").trim();
	return style ? `%{${style}}${inner}%` : String(inner ?? "");
}

export function setStyleProperty(styleText, prop, val) {
	const styles = parseStyleDeclaration(styleText);
	if (prop === "background-color") prop = BACKGROUND_PROP;
	const normalized = String(val ?? "").trim();
	if (normalized) styles[prop] = normalized;
	return serializeStyleDeclaration(styles);
}

export function removeStyleProperty(styleText, prop) {
	const styles = parseStyleDeclaration(styleText);
	if (prop === "background-color") prop = BACKGROUND_PROP;
	delete styles[prop];
	return serializeStyleDeclaration(styles);
}

// Find the innermost "%{...}...%" span whose content contains [start, end].
// A selection covering the whole span (start..end == matchStart..matchEnd) also matches.
// Returns match/content offsets plus the raw style declaration text, or null.
export function findStyleSpan(value, start, end) {
	const pattern = /%\{([^}]+)\}([\s\S]*?)%/g;
	let match;
	let best = null;
	while ((match = pattern.exec(value))) {
		const matchStart = match.index;
		const contentStart = matchStart + match[0].indexOf("}") + 1;
		const contentEnd = matchStart + match[0].length - 1;
		const matchEnd = matchStart + match[0].length;

		if (start >= matchStart && end <= matchEnd && contentStart <= start && end <= contentEnd) {
			// Prefer the innermost span containing the selection.
			if (!best || contentStart >= best.contentStart) {
				best = {
					styleText: match[1],
					inner: match[2],
					matchStart,
					contentStart,
					contentEnd,
					matchEnd,
				};
			}
		} else if (
			start === matchStart &&
			end === matchEnd &&
			(!best || contentStart >= best.contentStart)
		) {
			// Selection covers the entire span (markers included) — treat as whole span.
			best = {
				styleText: match[1],
				inner: match[2],
				matchStart,
				contentStart,
				contentEnd,
				matchEnd,
			};
		}
	}
	return best;
}
