import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const indexHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../index.html"), "utf8");

test("mermaid is loaded from a pinned version", () => {
	const urls = [...indexHtml.matchAll(/https:\/\/cdn\.jsdelivr\.net\/npm\/mermaid(@[^/]*)?\/dist\/mermaid\.esm\.min\.mjs/g)]
		.map((match) => match[0]);
	assert.ok(urls.length >= 1, "the mermaid script tag exists");
	for (const url of urls) {
		assert.match(url, /mermaid@\d+\.\d+\.\d+\//, `${url} must be pinned to an explicit version`);
	}
});
