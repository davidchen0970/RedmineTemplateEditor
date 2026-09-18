import {
	COLOR_PROP,
	buildStyleSpan,
	setStyleProperty,
	removeStyleProperty,
	findStyleSpan,
} from "./inline-styles.js";
import { applyStaticText } from "../../i18n.js";

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

	const range = findStyleSpan(value, start, end);
	if (range) {
		const whole = start === range.matchStart && end === range.matchEnd;
		const beforeInner = whole ? "" : value.slice(range.contentStart, start);
		const selectedInner = whole ? range.inner : value.slice(start, end);
		const afterInner = whole ? "" : value.slice(end, range.contentEnd);

		const oldStyle = range.styleText;
		const styledSelected = buildStyleSpan(
			setStyleProperty(oldStyle, COLOR_PROP, color),
			selectedInner,
		);

		let reBefore = "";
		let reAfter = "";
		if (beforeInner) reBefore = buildStyleSpan(oldStyle, beforeInner);
		if (afterInner) reAfter = buildStyleSpan(oldStyle, afterInner);

		inputElement.value =
			value.slice(0, range.matchStart) +
			reBefore +
			styledSelected +
			reAfter +
			value.slice(range.matchEnd);

		const newStart = range.matchStart + reBefore.length;
		inputElement.focus();
		inputElement.setSelectionRange(newStart, newStart + styledSelected.length);
		inputElement.dispatchEvent(
			new InputEvent("input", {
				bubbles: true,
				inputType: "insertText",
				data: reBefore + styledSelected + reAfter,
			}),
		);

		return true;
	}

	const wrapped = buildStyleSpan(COLOR_PROP + ":" + color, selected);

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
	const range = findStyleSpan(value, start, end);

	if (range) {
		const whole = start === range.matchStart && end === range.matchEnd;
		const before = whole ? "" : value.slice(range.contentStart, start);
		const selected = whole ? range.inner : value.slice(start, end);
		const after = whole ? "" : value.slice(end, range.contentEnd);

		const oldStyle = range.styleText;
		const clearedSelected = buildStyleSpan(
			removeStyleProperty(oldStyle, COLOR_PROP),
			selected,
		);

		let reBefore = "";
		let reAfter = "";
		if (before) reBefore = buildStyleSpan(oldStyle, before);
		if (after) reAfter = buildStyleSpan(oldStyle, after);

		inputElement.value =
			value.slice(0, range.matchStart) +
			reBefore +
			clearedSelected +
			reAfter +
			value.slice(range.matchEnd);

		const newStart = range.matchStart + reBefore.length;
		inputElement.focus();
		inputElement.setSelectionRange(newStart, newStart + clearedSelected.length);
		inputElement.dispatchEvent(
			new InputEvent("input", {
				bubbles: true,
				inputType: "insertText",
				data: reBefore + clearedSelected + reAfter,
			}),
		);

		return true;
	}

	// Not inside a style span: strip any spans fully contained in the selection.
	const selected = value.slice(start, end);
	const cleaned = selected.replace(/%\{[^}]+\}([\s\S]*?)%/g, "$1");

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

export function setupTextColorContextMenu() {
	let targetInput = null;

	const menu = document.createElement("div");
	menu.id = "textColorMenu";
	menu.className = "text-color-menu";
	menu.innerHTML = `
		<button type="button" class="red" data-color="red" data-i18n="fmt.red"></button>
		<button type="button" class="green" data-color="green" data-i18n="fmt.green"></button>
		<button type="button" class="orange" data-color="orange" data-i18n="fmt.orange"></button>
		<button type="button" data-clear-color="true" data-i18n="fmt.clearColor"></button>
	`;
	document.body.appendChild(menu);
	applyStaticText(menu);
	document.addEventListener("i18n:change", () => applyStaticText(menu));

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
