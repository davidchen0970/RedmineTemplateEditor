// i18n core — t(), locale switching, fallbacks. No DOM needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCALES, getLocale, setLocale, t } from "../../src/i18n.js";

test("i18n: default locale is a supported one (zh|en)", () => {
	assert.ok(getLocale() === "zh" || getLocale() === "en");
});

test("i18n: t() returns the key when it is missing from the dictionary", () => {
	assert.equal(t("nope.missing.key"), "nope.missing.key");
});

test("i18n: t() returns a non-empty value for a bundled action key", () => {
	assert.ok(typeof t("action.copy") === "string" && t("action.copy").length > 0);
});

test("i18n: t() interpolates {name} placeholders", () => {
	const out = t("section.delText", { name: "big section" });
	assert.ok(out.includes("big section"));
});

test("i18n: setLocale() switches the active dictionary", () => {
	const prev = getLocale();
	const next = prev === "zh" ? "en" : "zh";
	setLocale(next);
	assert.equal(getLocale(), next);
	// zh/en values differ for a translated key.
	assert.notEqual(t("form.title"), t("action.copy"));
});

test("i18n: setLocale() ignores unsupported locales (no-op)", () => {
	const before = getLocale();
	setLocale("fr"); // fr is not a bundled locale
	assert.equal(getLocale(), before);
});

test("i18n: setLocale() is a no-op when switching to the current locale", () => {
	const before = getLocale();
	setLocale(before);
	assert.equal(getLocale(), before);
});

test("i18n: both bundled dictionaries expose the same key set", () => {
	const a = Object.keys(LOCALES.en).sort();
	const b = Object.keys(LOCALES.zh).sort();
	assert.deepEqual(a, b);
});
