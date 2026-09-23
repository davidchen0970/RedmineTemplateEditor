import { t } from "../../i18n.js";

// Block-level display preference. Mirrors setupTheme(): a global UI pref kept in
// localStorage, defaulting to ON ("any value other than '0' means visible").
export function setupBlockLevelToggle(storageKey) {
	const button = document.getElementById("blockLevelToggle");
	const subscribers = [];

	if (!button) return { isVisible: () => true, onChange: (fn) => subscribers.push(fn) };

	const read = () => localStorage.getItem(storageKey) !== "0";

	// Like the theme toggle, the button shows what you will switch to next.
	const apply = (visible) => {
		button.textContent = visible ? t("blockLevel.hide") : t("blockLevel.show");
	};

	apply(read());

	button.onclick = () => {
		const next = !read();
		localStorage.setItem(storageKey, next ? "1" : "0");
		apply(next);
		subscribers.forEach((fn) => fn(next));
	};

	document.addEventListener("i18n:change", () => apply(read()));

	return {
		isVisible: read,
		onChange: (fn) => subscribers.push(fn),
	};
}
