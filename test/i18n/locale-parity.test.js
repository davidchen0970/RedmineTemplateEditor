// zh/en dictionary parity — the regression guard for the "one language blanked,
// the other still translated" bug class (a key left "" in en while zh keeps text).
import { test } from "node:test";
import assert from "node:assert/strict";
import { en } from "../../src/locales/en.js";
import { zh } from "../../src/locales/zh.js";

test("locales: en and zh expose exactly the same key set", () => {
	const onlyZh = Object.keys(zh).filter((k) => !(k in en));
	const onlyEn = Object.keys(en).filter((k) => !(k in zh));
	assert.deepEqual(onlyZh, [], `keys only in zh: ${onlyZh.join(", ")}`);
	assert.deepEqual(onlyEn, [], `keys only in en: ${onlyEn.join(", ")}`);
});

test("locales: every key maps to a string in both languages", () => {
	for (const key of Object.keys(en)) {
		assert.equal(typeof en[key], "string", `en.${key}`);
		assert.equal(typeof zh[key], "string", `zh.${key}`);
	}
});

test("locales: no key is translated in one language but blanked in the other", () => {
	for (const key of Object.keys(en)) {
		const enBlank = en[key].trim() === "";
		const zhBlank = zh[key].trim() === "";
		assert.equal(
			enBlank,
			zhBlank,
			`truthiness drift on ${key}: en=${en[key]}, zh=${zh[key]}`,
		);
	}
});

test("locales: zh is not just a copy of en (translated values differ)", () => {
	assert.notEqual(en["action.copy"], zh["action.copy"]);
	assert.ok(zh["brand.title"] && /輸出器|輸出|表單/.test(zh["form.panel.title"]));
});
