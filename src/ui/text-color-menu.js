function applyColorToTextareaSelection(el, color) {
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

	const whole = selected.match(/^%\{color:[^}]+\}([\s\S]*)%$/);

	if (whole) {
		const wrapped = buildColored(color, whole[1]);

		el.value = value.slice(0, start) + wrapped + value.slice(end);
		el.focus();
		el.setSelectionRange(start, start + wrapped.length);
		el.dispatchEvent(
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

		el.value =
			value.slice(0, range.matchStart) +
			replacement +
			value.slice(range.matchEnd);

		const newStart =
			range.matchStart +
			(beforeInner ? buildColored(range.oldColor, beforeInner).length : 0);
		const newEnd = newStart + buildColored(color, selectedInner).length;

		el.focus();
		el.setSelectionRange(newStart, newEnd);
		el.dispatchEvent(
			new InputEvent("input", {
				bubbles: true,
				inputType: "insertText",
				data: replacement,
			}),
		);

		return true;
	}

	const wrapped = buildColored(color, selected);

	el.value = value.slice(0, start) + wrapped + value.slice(end);
	el.focus();
	el.setSelectionRange(start, start + wrapped.length);
	el.dispatchEvent(
		new InputEvent("input", {
			bubbles: true,
			inputType: "insertText",
			data: wrapped,
		}),
	);

	return true;
}

function clearColorFromTextareaSelection(el) {
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

		el.value =
			value.slice(0, range.matchStart) +
			replacement +
			value.slice(range.matchEnd);

		const newStart =
			range.matchStart +
			(before ? buildColored(range.oldColor, before).length : 0);

		el.focus();
		el.setSelectionRange(newStart, newStart + selected.length);
		el.dispatchEvent(
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

	el.value = value.slice(0, start) + cleaned + value.slice(end);
	el.focus();
	el.setSelectionRange(start, start + cleaned.length);
	el.dispatchEvent(
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
	const re = /%\{color:([^}]+)\}([\s\S]*?)%/g;
	let m;

	while ((m = re.exec(value))) {
		const matchStart = m.index;
		const contentStart = matchStart + m[0].indexOf("}") + 1;
		const contentEnd = matchStart + m[0].length - 1;
		const matchEnd = matchStart + m[0].length;

		if (start >= matchStart && end <= matchEnd) {
			return {
				oldColor: m[1],
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

	const isEditableTextField = (el) =>
		el &&
		(el.tagName === "TEXTAREA" ||
			(el.tagName === "INPUT" &&
				["text", "search", "url", "email"].includes(el.type)));

	document.addEventListener("contextmenu", (event) => {
		const el = event.target;

		if (!isEditableTextField(el)) {
			hideMenu();
			return;
		}

		const start = el.selectionStart;
		const end = el.selectionEnd;

		if (
			typeof start !== "number" ||
			typeof end !== "number" ||
			start === end
		) {
			hideMenu();
			return;
		}

		targetInput = el;
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

