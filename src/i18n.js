// Minimal zero-build i18n for the Redmine Textile 輸出器.
//
// - locale is chosen at startup from navigator.language ("zh*" -> zh, else en)
//   and is NOT persisted (per requirement: re-detect each load).
// - t(key) reads the current locale's dictionary.
// - applyStaticText(locale) pushes locale strings into [data-i18n] / [data-i18n-ph]
//   / [data-i18n-title] elements.
// - setLocale(locale) swaps the current locale, re-applies static text, and
//   broadcasts an "i18n:change" CustomEvent that dynamic renderers listen for so
//   they re-emit their generated labels/buttons/toasts in the new language.

import { zh } from "./locales/zh.js";
import { en } from "./locales/en.js";

export const LOCALES = { zh, en };

let locale = detectLocale();

function detectLocale() {
	if (typeof navigator !== "undefined" && navigator.language) {
		return /^zh/i.test(navigator.language) ? "zh" : "en";
	}
	return "zh";
}

export function getLocale() {
	return locale;
}

export function setLocale(next) {
	if (!(next in LOCALES) || next === locale) return;
	locale = next;
	if (typeof document !== "undefined") {
		applyStaticText();
		document.dispatchEvent(new CustomEvent("i18n:change", { detail: { locale } }));
	}
}

export function t(key, vars) {
	const value = LOCALES[locale][key];
	if (value === undefined) return key;
	if (!vars) return value;
	return String(value).replace(/\{(\w+)\}/g, (match, name) =>
		Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match
	);
}

// Push the active locale into elements annotated in the static HTML.
export function applyStaticText(root) {
	const scope = root || document;
	scope.querySelectorAll?.("[data-i18n]").forEach((el) => {
		const key = el.dataset.i18n;
		if (LOCALES[locale][key]) el.textContent = LOCALES[locale][key];
	});
	scope.querySelectorAll?.("[data-i18n-ph]").forEach((el) => {
		const key = el.dataset.i18nPh;
		if (LOCALES[locale][key]) el.placeholder = LOCALES[locale][key];
	});
	scope.querySelectorAll?.("[data-i18n-title]").forEach((el) => {
		const key = el.dataset.i18nTitle;
		if (LOCALES[locale][key]) el.title = LOCALES[locale][key];
	});
}
