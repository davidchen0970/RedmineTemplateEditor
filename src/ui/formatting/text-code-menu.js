import { applyCodeWrap, clearCodeWrap } from "./code-markers.js";
import { applyStaticText } from "../../i18n.js";

function applyEdit(inputElement, result) {
	if (!result) return false;
	inputElement.value = result.value;
	focusAndSelect(inputElement, result.start, result.end);
	dispatchTextInput(inputElement, result.value);
	return true;
}

function applyCodeToTextareaSelection(inputElement) {
	const start = inputElement.selectionStart;
	const end = inputElement.selectionEnd;
	return applyEdit(inputElement, applyCodeWrap(inputElement.value, start, end));
}

function clearCodeFromTextareaSelection(inputElement) {
	const start = inputElement.selectionStart;
	const end = inputElement.selectionEnd;
	return applyEdit(inputElement, clearCodeWrap(inputElement.value, start, end));
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
				<button type="button" class="inline_code" data-inline-code="true" data-i18n="fmt.inlineCode"></button>
				<button type="button" data-clear-inline-code="true" data-i18n="fmt.clearCode"></button>
			`,
		);
		activeMenu.dataset.codeMenuReady = "true";
		applyStaticText(activeMenu);
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
