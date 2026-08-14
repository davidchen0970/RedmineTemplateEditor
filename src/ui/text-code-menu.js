function applyCodeToTextareaSelection(inputElement) {
	const start = inputElement.selectionStart;
	const end = inputElement.selectionEnd;
	if (
		typeof start !== "number" ||
		typeof end !== "number" ||
		start === end
	) {
		return false;
	}

	const value = inputElement.value;
	const selected = value.slice(start, end);

	// If the full selection is already @code@, keep the content and avoid
	// adding another pair of markers.
	const whole = selected.match(/^@([^@]+)@$/);
	if (whole) {
		const wrapped = buildCode(whole[1]);
		replaceTextareaRange(inputElement, start, end, wrapped, wrapped);
		return true;
	}

	// If the selected range is inside an existing @code@ span, split the span
	// and keep all pieces as code. This mirrors the color/background menu behavior
	// and prevents broken marker pairs.
	const range = findCodeRange(value, start, end);
	if (range && start >= range.contentStart && end <= range.contentEnd) {
		const beforeInner = value.slice(range.contentStart, start);
		const selectedInner = value.slice(start, end);
		const afterInner = value.slice(end, range.contentEnd);

		let replacement = "";
		if (beforeInner) {
			replacement += buildCode(beforeInner);
		}
		replacement += buildCode(selectedInner);
		if (afterInner) {
			replacement += buildCode(afterInner);
		}

		inputElement.value =
			value.slice(0, range.matchStart) +
			replacement +
			value.slice(range.matchEnd);

		const preservedBeforeLength = beforeInner ? buildCode(beforeInner).length : 0;
		const newStart = range.matchStart + preservedBeforeLength;
		const newEnd = newStart + buildCode(selectedInner).length;

		focusAndSelect(inputElement, newStart, newEnd);
		dispatchTextInput(inputElement, replacement);
		return true;
	}

	const wrapped = buildCode(selected);
	replaceTextareaRange(inputElement, start, end, wrapped, wrapped);
	return true;
}

function clearCodeFromTextareaSelection(inputElement) {
	const start = inputElement.selectionStart;
	const end = inputElement.selectionEnd;
	if (
		typeof start !== "number" ||
		typeof end !== "number" ||
		start === end
	) {
		return false;
	}

	const value = inputElement.value;
	const range = findCodeRange(value, start, end);

	// If the selection is inside @code@, remove code only from the selected
	// substring and preserve the unselected sides as code.
	if (range && start >= range.contentStart && end <= range.contentEnd) {
		const before = value.slice(range.contentStart, start);
		const selected = value.slice(start, end);
		const after = value.slice(end, range.contentEnd);

		let replacement = "";
		if (before) {
			replacement += buildCode(before);
		}
		replacement += selected;
		if (after) {
			replacement += buildCode(after);
		}

		inputElement.value =
			value.slice(0, range.matchStart) +
			replacement +
			value.slice(range.matchEnd);

		const preservedBeforeLength = before ? buildCode(before).length : 0;
		const newStart = range.matchStart + preservedBeforeLength;

		focusAndSelect(inputElement, newStart, newStart + selected.length);
		dispatchTextInput(inputElement, replacement);
		return true;
	}

	// Clear complete @code@ spans contained in the selection.
	const selected = value.slice(start, end);
	const cleaned = selected.replace(/@([^@]+)@/g, "$1");
	replaceTextareaRange(inputElement, start, end, cleaned, cleaned);
	return true;
}

function buildCode(text) {
	return `@${text}@`;
}

function findCodeRange(value, start, end) {
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

function replaceTextareaRange(inputElement, start, end, replacement, inputData) {
	inputElement.value = inputElement.value.slice(0, start) + replacement + inputElement.value.slice(end);
	focusAndSelect(inputElement, start, start + replacement.length);
	dispatchTextInput(inputElement, inputData);
}

function focusAndSelect(inputElement, start, end) {
	inputElement.focus();
	inputElement.setSelectionRange(start, end);
}

function dispatchTextInput(inputElement, data) {
	if (typeof InputEvent === "function") {
		inputElement.dispatchEvent(
			new InputEvent("input", {
				bubbles: true,
				inputType: "insertText",
				data,
			}),
		);
		return;
	}
	inputElement.dispatchEvent(new Event("input", { bubbles: true }));
}

export function setupTextCodeContextMenu() {
	let targetInput = null;
	let ownMenu = null;
	let menu = document.getElementById("textColorMenu");

	const isEditableTextField = (element) =>
		element &&
		(element.tagName === "TEXTAREA" ||
			(element.tagName === "INPUT" &&
				["text", "search", "url", "email"].includes(element.type)));

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
		// independent menu. In this repo, prefer loading text-color-menu.js first so
		// color, background, and code actions share the same right-click menu.
		ownMenu = document.createElement("div");
		ownMenu.id = "textCodeMenu";
		ownMenu.className = "text-color-menu text-code-menu";
		document.body.appendChild(ownMenu);
		menu = ownMenu;
		return menu;
	};

	const renderCodeButtons = () => {
		const activeMenu = ensureMenu();
		if (activeMenu.dataset.codeMenuReady === "true") {
			return activeMenu;
		}

		activeMenu.insertAdjacentHTML(
			"beforeend",
			`
				<div class="text-code-menu-divider" aria-hidden="true"></div>
				<button type="button" class="inline_code" data-inline-code="true">標成 Code</button>
				<button type="button" data-clear-inline-code="true">清除 Code</button>
			`,
		);
		activeMenu.dataset.codeMenuReady = "true";
		return activeMenu;
	};

	renderCodeButtons();

	document.addEventListener("contextmenu", (event) => {
		const targetElement = event.target;
		if (!isEditableTextField(targetElement)) {
			hideOwnMenu();
			return;
		}

		const start = targetElement.selectionStart;
		const end = targetElement.selectionEnd;
		if (
			typeof start !== "number" ||
			typeof end !== "number" ||
			start === end
		) {
			hideOwnMenu();
			return;
		}

		targetInput = targetElement;
		const activeMenu = renderCodeButtons();

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

		if (btn.dataset.inlineCode) {
			applyCodeToTextareaSelection(targetInput);
		}
		if (btn.dataset.clearInlineCode) {
			clearCodeFromTextareaSelection(targetInput);
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
