// Theme toggle: initial theme, click flip, persistence, i18n-aware re-label.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";

test("theme: default light theme labels the toggle with the dark-mode option", async () => {
	const { w } = makeDom('<button id="themeToggle" type="button"></button>');
	const { t } = await import("../../src/i18n.js");
	const { setupTheme } = await import("../../src/ui/theme/theme.js");

	setupTheme("__theme_test__");

	const btn = w.document.getElementById("themeToggle");
	assert.equal(w.document.body.dataset.theme, "light");
	assert.equal(btn.textContent, t("theme.dark"));
});

test("theme: clicking flips the theme, persists it, and re-labels the toggle", async () => {
	const { w } = makeDom('<button id="themeToggle" type="button"></button>');
	const { t } = await import("../../src/i18n.js");
	const { setupTheme } = await import("../../src/ui/theme/theme.js");

	setupTheme("__theme_test__");
	w.document.getElementById("themeToggle").click();

	const btn = w.document.getElementById("themeToggle");
	assert.equal(w.document.body.dataset.theme, "dark");
	assert.equal(w.localStorage.getItem("__theme_test__"), "dark");
	assert.equal(btn.textContent, t("theme.light"));
});

test("theme: i18n:change re-labels without clobbering the active theme", async () => {
	const { w } = makeDom('<button id="themeToggle" type="button"></button>');
	const { t } = await import("../../src/i18n.js");
	const { setupTheme } = await import("../../src/ui/theme/theme.js");

	setupTheme("__theme_test__");
	w.document.getElementById("themeToggle").click(); // body -> dark

	w.document.dispatchEvent(new w.CustomEvent("i18n:change"));

	assert.equal(w.document.body.dataset.theme, "dark"); // theme survived
	assert.equal(w.document.getElementById("themeToggle").textContent, t("theme.light"));
});
