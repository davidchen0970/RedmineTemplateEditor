// Pure string helpers for Redmine Textile inline code markers (@code@), separated
// from the textarea DOM so the wrap/clear decision can be unit-tested. Each edit
// outputs { value, start, end } describing the replacement string and where the
// caret should end up; the caller applies them to the real <textarea>.

function buildCode(text) {
	return `@${text}@`;
}

// Find the innermost "@...@" span containing [start, end]. A selection covering a
// whole "@content@" also matches (markers included) so it can be re-wrapped.
// Returns offsets plus the inner text, or null.
export function findCodeRange(value, start, end) {
	const codePattern = /@([^@]+)@/g;
	let match;
	while ((match = codePattern.exec(value))) {
		const matchStart = match.index;
		const contentStart = matchStart + 1;
		const contentEnd = matchStart + match[0].length - 1;
		const matchEnd = matchStart + match[0].length;
		if (start >= matchStart && end <= matchEnd) {
			return {
				matchStart,
				contentStart,
				contentEnd,
				matchEnd,
				inner: match[1],
			};
		}
	}
	return null;
}

function replaceRange(value, start, end, replacement) {
	return {
		value: value.slice(0, start) + replacement + value.slice(end),
		start,
		end: start + replacement.length,
	};
}

// Wrap the selection in @code@ unless it already is one; if the selection sits
// inside an existing @...@ span, split and keep every piece as code (this prevents
// broken marker pairs). Returns { value, start, end } or null when no-op.
export function applyCodeWrap(value, start, end) {
	if (typeof start !== "number" || typeof end !== "number" || start === end) return null;
	const selected = value.slice(start, end);

	// The whole selection is already exactly @content@ — keep the content only.
	const whole = selected.match(/^@([^@]+)@$/);
	if (whole) {
		return replaceRange(value, start, end, buildCode(whole[1]), buildCode(whole[1]));
	}

	// Inside an existing @code@ span: wrap the selected substring and re-wrap the
	// unselected sides so no pair breaks.
	const range = findCodeRange(value, start, end);
	if (range && start >= range.contentStart && end <= range.contentEnd) {
		const beforeInner = value.slice(range.contentStart, start);
		const selectedInner = value.slice(start, end);
		const afterInner = value.slice(end, range.contentEnd);

		let replacement = "";
		if (beforeInner) replacement += buildCode(beforeInner);
		replacement += buildCode(selectedInner);
		if (afterInner) replacement += buildCode(afterInner);

		const newValue = value.slice(0, range.matchStart) + replacement + value.slice(range.matchEnd);
		const preservedBeforeLength = beforeInner ? buildCode(beforeInner).length : 0;
		return {
			value: newValue,
			start: range.matchStart + preservedBeforeLength,
			end: range.matchStart + preservedBeforeLength + buildCode(selectedInner).length,
		};
	}

	return replaceRange(value, start, end, buildCode(selected));
}

// Remove @code@ from the selection. If it sits inside an existing span, clear only
// the selected substring and keep the unselected sides as code. Returns the edited
// { value, start, end } or null when the selection is empty.
export function clearCodeWrap(value, start, end) {
	if (typeof start !== "number" || typeof end !== "number" || start === end) return null;

	const range = findCodeRange(value, start, end);

	// Inside @code@: clear only the selected part, keep sides as code.
	if (range && start >= range.contentStart && end <= range.contentEnd) {
		const before = value.slice(range.contentStart, start);
		const selected = value.slice(start, end);
		const after = value.slice(end, range.contentEnd);

		let replacement = "";
		if (before) replacement += buildCode(before);
		replacement += selected;
		if (after) replacement += buildCode(after);

		const newValue = value.slice(0, range.matchStart) + replacement + value.slice(range.matchEnd);
		const preservedBeforeLength = before ? buildCode(before).length : 0;
		return {
			value: newValue,
			start: range.matchStart + preservedBeforeLength,
			end: range.matchStart + preservedBeforeLength + selected.length,
		};
	}

	// Not inside code: strip any whole @...@ spans contained in the selection.
	const selected = value.slice(start, end);
	const cleaned = selected.replace(/@([^@]+)@/g, "$1");
	return replaceRange(value, start, end, cleaned);
}
