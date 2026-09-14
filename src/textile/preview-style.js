// Pure helpers: filter any CSS string (`background:yellow; color:red`) down to a safe inline style,
// turn a `%{style}body%` textile style span into a <span style=...>,
// and when a background is high-brightness (so it would wash out in dark mode), force a dark text color.
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

function hslToRgb(h, s, l) {
	s /= 100;
	l /= 100;
	const k = (n) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const fn = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	return [Math.round(255 * fn(0)), Math.round(255 * fn(8)), Math.round(255 * fn(4))];
}

const NAMED_COLORS = {
	aliceblue: "f0f8ff", antiquewhite: "faebd7", aqua: "00ffff", aquamarine: "7fffd4",
	azure: "f0ffff", beige: "f5f5dc", bisque: "ffe4c4", black: "000000",
	blanchedalmond: "ffebcd", blue: "0000ff", blueviolet: "8a2be2", brown: "a52a2a",
	burlywood: "deb887", cadetblue: "5f9ea0", chartreuse: "7fff00", chocolate: "d2691e",
	coral: "ff7f50", cornflowerblue: "6495ed", cornsilk: "fff8dc", crimson: "dc143c",
	cyan: "00ffff", darkblue: "00008b", darkcyan: "008b8b", darkgoldenrod: "b8860b",
	darkgray: "a9a9a9", darkgrey: "a9a9a9", darkgreen: "006400", darkkhaki: "bdb76b",
	darkmagenta: "8b008b", darkolivegreen: "556b2f", darkorange: "ff8c00", darkorchid: "9932cc",
	darkred: "8b0000", darksalmon: "e9967a", darkseagreen: "8fbc8f", darkslateblue: "483d8b",
	darkslategray: "2f4f4f", darkslategrey: "2f4f4f", darkturquoise: "00ced1", darkviolet: "9400d3",
	deeppink: "ff1493", deepskyblue: "00bfff", dimgray: "696969", dimgrey: "696969",
	dodgerblue: "1e90ff", firebrick: "b22222", floralwhite: "fffaf0", forestgreen: "228b22",
	fuchsia: "ff00ff", gainsboro: "dcdcdc", ghostwhite: "f8f8ff", gold: "ffd700",
	goldenrod: "daa520", gray: "808080", grey: "808080", green: "008000",
	greenyellow: "adff2f", honeydew: "f0fff0", hotpink: "ff69b4", indianred: "cd5c5c",
	indigo: "4b0082", ivory: "fffff0", khaki: "f0e68c", lavender: "e6e6fa",
	lavenderblush: "fff0f5", lawngreen: "7cfc00", lemonchiffon: "fffacd", lightblue: "add8e6",
	lightcoral: "f08080", lightcyan: "e0ffff", lightgoldenrodyellow: "fafad2", lightgray: "d3d3d3",
	lightgrey: "d3d3d3", lightgreen: "90ee90", lightpink: "ffb6c1", lightsalmon: "ffa07a",
	lightseagreen: "20b2aa", lightskyblue: "87cefa", lightslategray: "778899", lightslategrey: "778899",
	lightsteelblue: "b0c4de", lightyellow: "ffffe0", lime: "00ff00", limegreen: "32cd32",
	linen: "faf0e6", magenta: "ff00ff", maroon: "800000", mediumaquamarine: "66cdaa",
	mediumblue: "0000cd", mediumorchid: "ba55d3", mediumpurple: "9370db", mediumseagreen: "3cb371",
	mediumslateblue: "7b68ee", mediumspringgreen: "00fa9a", mediumturquoise: "48d1cc", mediumvioletred: "c71585",
	midnightblue: "191970", mintcream: "f5fffa", mistyrose: "ffe4e1", moccasin: "ffe4b5",
	navajowhite: "ffdead", navy: "000080", oldlace: "fdf5e6", olive: "808000",
	olivedrab: "6b8e23", orange: "ffa500", orangered: "ff4500", orchid: "da70d6",
	palegoldenrod: "eee8aa", palegreen: "98fb98", paleturquoise: "afeeee", palevioletred: "db7093",
	papayawhip: "ffefd5", peachpuff: "ffdab9", peru: "cd853f", pink: "ffc0cb",
	plum: "dda0dd", powderblue: "b0e0e6", purple: "800080", rebeccapurple: "663399",
	red: "ff0000", rosybrown: "bc8f8f", royalblue: "4169e1", saddlebrown: "8b4513",
	salmon: "fa8072", sandybrown: "f4a460", seagreen: "2e8b57", seashell: "fff5ee",
	sienna: "a0522d", silver: "c0c0c0", skyblue: "87ceeb", slateblue: "6a5acd",
	slategray: "708090", slategrey: "708090", snow: "fffafa", springgreen: "00ff7f",
	steelblue: "4682b4", tan: "d2b48c", teal: "008080", thistle: "d8bfd8",
	tomato: "ff6347", turquoise: "40e0d0", violet: "ee82ee", wheat: "f5deb3",
	white: "ffffff", whitesmoke: "f5f5f5", yellow: "ffff00", yellowgreen: "9acd32"
};

function hexToRgb(hex) {
	const r = parseInt(hex.slice(0, 2), 16);
	const g = parseInt(hex.slice(2, 4), 16);
	const b = parseInt(hex.slice(4, 6), 16);
	return [r, g, b];
}

export function parsePreviewColorRgb(value) {
	const v = String(value ?? "").trim().toLowerCase();
	if (!v || /^(transparent|none|currentcolor)$/.test(v)) return null;
	let m = v.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
	if (m) return hslToRgb(parseFloat(m[1]) % 360, parseFloat(m[2]), parseFloat(m[3]));
	m = v.match(/rgb\(\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*\)/);
	if (m) return m.slice(1).map((part) => part.includes("%") ? Math.round(parseFloat(part) * 255 / 100) : Number(part));
	m = v.match(/#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/);
	if (m) {
		let hex = m[1];
		if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
		return hexToRgb(hex);
	}
	if (/^[a-z]+$/.test(v) && NAMED_COLORS[v]) return hexToRgb(NAMED_COLORS[v]);
	return null;
}

export function isHighBrightnessBackground(style) {
	const backgroundMatch = String(style ?? "").match(/(?:^|;\s*)(?:background|background-color)\s*:\s*([^;]+)/i);
	if (!backgroundMatch) return false;
	const rgb = parsePreviewColorRgb(backgroundMatch[1]);
	if (!rgb) return false;
	const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
	return luminance > 0.6;
}

export function renderPreviewTextileStyleSpans(text) {
	let previous;
	const spanPattern = /%\{([^}]+)\}([^%]+)%/g;
	do {
		previous = text;
		text = text.replace(spanPattern, (fullMatch, rawStyle, body) => {
			const style = normalizePreviewCssStyle(rawStyle);
			if (!style) return body;
			const hasTextColor = /(?:^|;\s*)color\s*:/i.test(style);
			if (!hasTextColor && isHighBrightnessBackground(style)) {
				return `<span style="${style}; color:#1f2328">${body}</span>`;
			}
			return `<span style="${style}">${body}</span>`;
		});
	} while (text !== previous);
	return text;
}
