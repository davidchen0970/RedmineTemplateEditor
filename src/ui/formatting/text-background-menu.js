import {
	BACKGROUND_PROP,
	buildStyleSpan,
	setStyleProperty,
	removeStyleProperty,
	findStyleSpan,
} from "./inline-styles.js";
import { applyStaticText } from "../../i18n.js";

function applyBackgroundToTextareaSelection(inputElement, backgroundColor) {
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
			setStyleProperty(oldStyle, BACKGROUND_PROP, backgroundColor),
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
		const newEnd = newStart + styledSelected.length;
		inputElement.focus();
		inputElement.setSelectionRange(newStart, newEnd);
		inputElement.dispatchEvent(
			new InputEvent("input", {
				bubbles: true,
				inputType: "insertText",
				data: reBefore + styledSelected + reAfter,
			}),
		);

		return true;
	}

	const wrapped = buildStyleSpan(BACKGROUND_PROP + ":" + backgroundColor, selected);
	replaceTextareaRange(inputElement, start, end, wrapped, wrapped);
	return true;
}

function clearBackgroundFromTextareaSelection(inputElement) {
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
			removeStyleProperty(oldStyle, BACKGROUND_PROP),
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
	replaceTextareaRange(inputElement, start, end, cleaned, cleaned);
	return true;
}

function replaceTextareaRange(inputElement, start, end, replacement, inputData) {
	inputElement.value = inputElement.value.slice(0, start) + replacement + inputElement.value.slice(end);
	inputElement.focus();
	inputElement.setSelectionRange(start, start + replacement.length);
	dispatchTextInput(inputElement, inputData);
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

export function setupTextBackgroundContextMenu() {
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
				<button type="button" class="b_yellow" data-background-color="yellow" data-i18n="fmt.bgYellow"></button>
				<button type="button" class="b_cyan" data-background-color="cyan" data-i18n="fmt.bgCyan"></button>
				<button type="button" class="b_lightgreen" data-background-color="lightgreen" data-i18n="fmt.bgLightgreen"></button>
				<button type="button" data-clear-background="true" data-i18n="fmt.clearBg"></button>
			`,
		);
		activeMenu.dataset.backgroundMenuReady = "true";
		applyStaticText(activeMenu);
		return activeMenu;
	};

	renderBackgroundButtons();

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
		event.preventDefault();

		menu.style.left = `${event.clientX}px`;
		menu.style.top = `${event.clientY}px`;
		menu.classList.add("show");
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
