function applyColorToTextareaSelection(inputElement, color) {
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

	const whole = selected.match(/^%\{color:[^}]+\}([\s\S]*)%$/);

	if (whole) {
		const wrapped = buildColored(color, whole[1]);

		inputElement.value = value.slice(0, start) + wrapped + value.slice(end);
		inputElement.focus();
		inputElement.setSelectionRange(start, start + wrapped.length);
		inputElement.dispatchEvent(
			new InputEvent("input", {
				bubbles: true,
				inputType: "insertText",
				data: wrapped,
			}),
		);

		return true;
	}

	const range = findColorRange(value, start, end);

	if (range && start >= range.contentStart && end <= range.contentEnd) {
		const beforeInner = value.slice(range.contentStart, start);
		const selectedInner = value.slice(start, end);
		const afterInner = value.slice(end, range.contentEnd);

		let replacement = "";

		if (beforeInner) {
			replacement += buildColored(range.oldColor, beforeInner);
		}

		replacement += buildColored(color, selectedInner);

		if (afterInner) {
			replacement += buildColored(range.oldColor, afterInner);
		}

		inputElement.value =
			value.slice(0, range.matchStart) +
			replacement +
			value.slice(range.matchEnd);

		const newStart =
			range.matchStart +
			(beforeInner ? buildColored(range.oldColor, beforeInner).length : 0);
		const newEnd = newStart + buildColored(color, selectedInner).length;

		inputElement.focus();
		inputElement.setSelectionRange(newStart, newEnd);
		inputElement.dispatchEvent(
			new InputEvent("input", {
				bubbles: true,
				inputType: "insertText",
				data: replacement,
			}),
		);

		return true;
	}

	const wrapped = buildColored(color, selected);

	inputElement.value = value.slice(0, start) + wrapped + value.slice(end);
	inputElement.focus();
	inputElement.setSelectionRange(start, start + wrapped.length);
	inputElement.dispatchEvent(
		new InputEvent("input", {
			bubbles: true,
			inputType: "insertText",
			data: wrapped,
		}),
	);

	return true;
}

function clearColorFromTextareaSelection(inputElement) {
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
	const range = findColorRange(value, start, end);

	if (range && start >= range.contentStart && end <= range.contentEnd) {
		const before = value.slice(range.contentStart, start);
		const selected = value.slice(start, end);
		const after = value.slice(end, range.contentEnd);

		let replacement = "";

		if (before) {
			replacement += buildColored(range.oldColor, before);
		}

		replacement += selected;

		if (after) {
			replacement += buildColored(range.oldColor, after);
		}

		inputElement.value =
			value.slice(0, range.matchStart) +
			replacement +
			value.slice(range.matchEnd);

		const newStart =
			range.matchStart +
			(before ? buildColored(range.oldColor, before).length : 0);

		inputElement.focus();
		inputElement.setSelectionRange(newStart, newStart + selected.length);
		inputElement.dispatchEvent(
			new InputEvent("input", {
				bubbles: true,
				inputType: "insertText",
				data: replacement,
			}),
		);

		return true;
	}

	const selected = value.slice(start, end);
	const cleaned = selected.replace(/%\{color:[^}]+\}([\s\S]*?)%/g, "$1");

	inputElement.value = value.slice(0, start) + cleaned + value.slice(end);
	inputElement.focus();
	inputElement.setSelectionRange(start, start + cleaned.length);
	inputElement.dispatchEvent(
		new InputEvent("input", {
			bubbles: true,
			inputType: "insertText",
			data: cleaned,
		}),
	);

	return true;
}

function buildColored(color, text) {
	return `%{color:${color}}${text}%`;
}

function findColorRange(value, start, end) {
	const colorPattern = /%\{color:([^}]+)\}([\s\S]*?)%/g;
	let match;

	while ((match = colorPattern.exec(value))) {
		const matchStart = match.index;
		const contentStart = matchStart + match[0].indexOf("}") + 1;
		const contentEnd = matchStart + match[0].length - 1;
		const matchEnd = matchStart + match[0].length;

		if (start >= matchStart && end <= matchEnd) {
			return {
				oldColor: match[1],
				matchStart,
				contentStart,
				contentEnd,
				matchEnd,
				inner: match[2],
			};
		}
	}

	return null;
}

export function setupTextColorContextMenu() {
	let targetInput = null;

	const menu = document.createElement("div");
	menu.id = "textColorMenu";
	menu.className = "text-color-menu";
	menu.innerHTML = `
		<button type="button" class="red" data-color="red">標成紅色</button>
		<button type="button" class="green" data-color="green">標成綠色</button>
		<button type="button" class="orange" data-color="orange">標成橘色</button>
		<button type="button" data-clear-color="true">清除顏色</button>
	`;
	document.body.appendChild(menu);

	const hideMenu = () => {
		menu.classList.remove("show");
	};

	const isEditableTextField = (element) =>
		element &&
		(element.tagName === "TEXTAREA" ||
			(element.tagName === "INPUT" &&
				["text", "search", "url", "email"].includes(element.type)));

	document.addEventListener("contextmenu", (event) => {
		const targetElement = event.target;

		if (!isEditableTextField(targetElement)) {
			hideMenu();
			return;
		}

		const start = targetElement.selectionStart;
		const end = targetElement.selectionEnd;

		if (
			typeof start !== "number" ||
			typeof end !== "number" ||
			start === end
		) {
			hideMenu();
			return;
		}

		targetInput = targetElement;
		event.preventDefault();

		menu.style.left = `${event.clientX}px`;
		menu.style.top = `${event.clientY}px`;
		menu.classList.add("show");
	});

	menu.addEventListener("click", (event) => {
		const btn = event.target.closest("button");
		if (!btn || !targetInput) return;

		if (btn.dataset.color) {
			applyColorToTextareaSelection(targetInput, btn.dataset.color);
		}

		if (btn.dataset.clearColor) {
			clearColorFromTextareaSelection(targetInput);
		}

		hideMenu();
	});

	document.addEventListener("click", (event) => {
		if (!menu.contains(event.target)) {
			hideMenu();
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			hideMenu();
		}
	});

	window.addEventListener("scroll", hideMenu, true);
	window.addEventListener("resize", hideMenu);
}

