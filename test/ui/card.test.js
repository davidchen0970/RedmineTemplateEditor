import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";

test("card: blockCard resolves by id and reports a miss", async () => {
	const { w } = makeDom('<div class="section"><div class="block" data-block="b1"></div></div>');
	const { blockCard } = await import("../../src/ui/dom/card.js");
	assert.equal(blockCard("b1").dataset.block, "b1");
	assert.equal(blockCard("missing"), null);
});

test("card: sectionCard climbs from the body id to the .section", async () => {
	const { w } = makeDom('<div class="section" id="wrap"><div id="section-body-s9"></div></div>');
	const { sectionCard } = await import("../../src/ui/dom/card.js");
	const el = sectionCard("s9");
	assert.ok(el);
	assert.ok(el.classList.contains("section"));
	assert.equal(sectionCard("nope"), null);
});
