import { t } from "../../i18n.js";

export function setupTheme(storageKey) {
	const button = document.getElementById("themeToggle");
	if (!button) return;

	const read = () => {
		const saved = localStorage.getItem(storageKey);
		if (saved === "dark" || saved === "light") return saved;
		return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	};

	const apply = (theme) => {
		document.body.dataset.theme = theme;
		// The toggle shows the theme you will switch to next.
		button.textContent = theme === "dark" ? t("theme.light") : t("theme.dark");
	};

	apply(read());

	button.onclick = () => {
		const next = document.body.dataset.theme === "dark" ? "light" : "dark";
		localStorage.setItem(storageKey, next);
		apply(next);
	};

	// Keep the toggle bilingual without clobbering the theme-dependent label.
	document.addEventListener("i18n:change", () => apply(document.body.dataset.theme));
}
