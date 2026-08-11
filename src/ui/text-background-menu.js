function applyBackgroundToTextareaSelection(el, backgroundColor) {
	const start = el.selectionStart;
	const end = el.selectionEnd;
	if (
		typeof start !== "number" ||
		typeof end !== "number" ||
		start === end
	) {
		return false;
	}

	const value = el.value;
	const selected = value.slice(start, end);

	// If the whole selection is already one background span, replace only its color.
	const whole = selected.match(/^%\{background(?:-color)?:[^}]+\}([\s\S]*)%$/);
	if (whole) {
		const wrapped = buildBackgrounded(backgroundColor, whole[1]);
		replaceTextareaRange(el, start, end, wrapped, wrapped);
		return true;
	}

	// If the selection is inside an existing background span, split the old span so
	// only the selected substring receives the new background color.
	const range = findBackgroundRange(value, start, end);
	if (range && start >= range.contentStart && end <= range.contentEnd) {
		const beforeInner = value.slice(range.contentStart, start);
		const selectedInner = value.slice(start, end);
		const afterInner = value.slice(end, range.contentEnd);

		let replacement = "";
		if (beforeInner) {
			replacement += buildBackgrounded(range.oldBackground, beforeInner);
		}
		replacement += buildBackgrounded(backgroundColor, selectedInner);
		if (afterInner) {
			replacement += buildBackgrounded(range.oldBackground, afterInner);
		}

		const newValue =
			value.slice(0, range.matchStart) +
			replacement +
			value.slice(range.matchEnd);

		el.value = newValue;

		const preservedBeforeLength = beforeInner
			? buildBackgrounded(range.oldBackground, beforeInner).length
			: 0;
		const newStart = range.matchStart + preservedBeforeLength;
		const newEnd = newStart + buildBackgrounded(backgroundColor, selectedInner).length;

		focusAndSelect(el, newStart, newEnd);
		dispatchTextInput(el, replacement);
		return true;
	}

	// Normal case. This intentionally creates a separate Textile span instead of
	// merging with color spans, so the existing text-color-menu.js can still find,
	// change, and clear %{color:...} spans safely.
	const wrapped = buildBackgrounded(backgroundColor, selected);
	replaceTextareaRange(el, start, end, wrapped, wrapped);
	return true;
}

function clearBackgroundFromTextareaSelection(el) {
	const start = el.selectionStart;
	const end = el.selectionEnd;
	if (
		typeof start !== "number" ||
		typeof end !== "number" ||
		start === end
	) {
		return false;
	}

	const value = el.value;
	const range = findBackgroundRange(value, start, end);

	// If the selection is inside a background span, remove the background only from
	// the selected substring and preserve the unselected sides with the old color.
	if (range && start >= range.contentStart && end <= range.contentEnd) {
		const before = value.slice(range.contentStart, start);
		const selected = value.slice(start, end);
		const after = value.slice(end, range.contentEnd);

		let replacement = "";
		if (before) {
			replacement += buildBackgrounded(range.oldBackground, before);
		}
		replacement += selected;
		if (after) {
			replacement += buildBackgrounded(range.oldBackground, after);
		}

		el.value =
			value.slice(0, range.matchStart) +
			replacement +
			value.slice(range.matchEnd);

		const preservedBeforeLength = before
			? buildBackgrounded(range.oldBackground, before).length
			: 0;
		const newStart = range.matchStart + preservedBeforeLength;

		focusAndSelect(el, newStart, newStart + selected.length);
		dispatchTextInput(el, replacement);
		return true;
	}

	// Clear standalone background spans that are fully contained in the selection.
	const selected = value.slice(start, end);
	const cleaned = selected.replace(
		/%\{background(?:-color)?:[^}]+\}([\s\S]*?)%/g,
		"$1",
	);
	replaceTextareaRange(el, start, end, cleaned, cleaned);
	return true;
}

function buildBackgrounded(backgroundColor, text) {
	return `%{background-color:${backgroundColor}}${text}%`;
}

function findBackgroundRange(value, start, end) {
	const re = /%\{background(?:-color)?:([^}]+)\}([\s\S]*?)%/g;
	let m;
	while ((m = re.exec(value))) {
		const matchStart = m.index;
		const contentStart = matchStart + m[0].indexOf("}") + 1;
		const contentEnd = matchStart + m[0].length - 1;
		const matchEnd = matchStart + m[0].length;
		if (start >= matchStart && end <= matchEnd) {
			return {
				oldBackground: m[1],
				matchStart,
				contentStart,
				contentEnd,
				matchEnd,
				inner: m[2],
			};
		}
	}
	return null;
}

function replaceTextareaRange(el, start, end, replacement, inputData) {
	el.value = el.value.slice(0, start) + replacement + el.value.slice(end);
	focusAndSelect(el, start, start + replacement.length);
	dispatchTextInput(el, inputData);
}

function focusAndSelect(el, start, end) {
	el.focus();
	el.setSelectionRange(start, end);
}

function dispatchTextInput(el, data) {
	if (typeof InputEvent === "function") {
		el.dispatchEvent(
			new InputEvent("input", {
				bubbles: true,
				inputType: "insertText",
				data,
			}),
		);
		return;
	}
	el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function setupTextBackgroundContextMenu() {
	let targetInput = null;
	let ownMenu = null;
	let menu = document.getElementById("textColorMenu");

	const isEditableTextField = (el) =>
		el &&
		(el.tagName === "TEXTAREA" ||
			(el.tagName === "INPUT" &&
				["text", "search", "url", "email"].includes(el.type)));

	const hideOwnMenu = () => {
		if (ownMenu) {
			ownMenu.classList.remove("show");
		}
	};

	const ensureMenu = () => {
		menu = document.getElementById("textColorMenu");
		if (menu) {
			return menu;
		}

		// Fallback: if this module is used without text-color-menu.js, create an
		// independent menu. In the repo, prefer loading text-color-menu.js first so
		// both features share the same right-click menu.
		ownMenu = document.createElement("div");
		ownMenu.id = "textBackgroundMenu";
		ownMenu.className = "text-color-menu text-background-menu";
		document.body.appendChild(ownMenu);
		menu = ownMenu;
		return menu;
	};

	const renderBackgroundButtons = () => {
		const activeMenu = ensureMenu();
		if (activeMenu.dataset.backgroundMenuReady === "true") {
			return activeMenu;
		}

		activeMenu.insertAdjacentHTML(
			"beforeend",
			`
				<div class="text-background-menu-divider" aria-hidden="true"></div>
				<button type="button" class="b_yellow" data-background-color="yellow">背景黃色</button>
				<button type="button" class="b_cyan" data-background-color="cyan">背景青色</button>
				<button type="button" class="b_lightgreen" data-background-color="lightgreen">背景淺綠</button>
				<button type="button" data-clear-background="true">清除背景</button>
			`,
		);
		activeMenu.dataset.backgroundMenuReady = "true";
		return activeMenu;
	};

	renderBackgroundButtons();

	document.addEventListener("contextmenu", (event) => {
		const el = event.target;
		if (!isEditableTextField(el)) {
			hideOwnMenu();
			return;
		}

		const start = el.selectionStart;
		const end = el.selectionEnd;
		if (
			typeof start !== "number" ||
			typeof end !== "number" ||
			start === end
		) {
			hideOwnMenu();
			return;
		}

		targetInput = el;
		const activeMenu = renderBackgroundButtons();

		// If text-color-menu.js exists, it owns preventDefault and positioning.
		// If it does not exist, this module behaves independently.
		if (activeMenu === ownMenu) {
			event.preventDefault();
			ownMenu.style.left = `${event.clientX}px`;
			ownMenu.style.top = `${event.clientY}px`;
			ownMenu.classList.add("show");
		}
	});

	document.addEventListener("click", (event) => {
		const btn = event.target.closest("button");
		if (!btn || !targetInput) {
			return;
		}

		if (btn.dataset.backgroundColor) {
			applyBackgroundToTextareaSelection(targetInput, btn.dataset.backgroundColor);
		}
		if (btn.dataset.clearBackground) {
			clearBackgroundFromTextareaSelection(targetInput);
		}
		hideOwnMenu();
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			hideOwnMenu();
		}
	});
	window.addEventListener("scroll", hideOwnMenu, true);
	window.addEventListener("resize", hideOwnMenu);
}
