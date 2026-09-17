import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";
import { LEAVE_MS, SLIDE_MS } from "../../src/ui/motion/timing.js";

test("motion: markEntering / markLeaving stage a card via classes", async () => {
	const { w } = makeDom('<div id="card"></div>');
	const { markEntering, markLeaving } = await import("../../src/ui/motion/card-stage.js");
	const locate = (id) => w.document.getElementById(id);

	markEntering("card", locate);
	assert.ok(w.document.getElementById("card").classList.contains("is-entering"));

	let doneCalls = 0;
	markLeaving("card", locate, () => { doneCalls += 1; });
	const el = w.document.getElementById("card");
	assert.ok(el.classList.contains("is-leaving"));
	el.dispatchEvent(new w.Event("animationend"));
	assert.equal(doneCalls, 1);
});

test("motion: markLeaving resolves immediately when the node is missing", async () => {
	const { w } = makeDom();
	const { markLeaving } = await import("../../src/ui/motion/card-stage.js");
	let doneCalls = 0;
	markLeaving("ghost", (id) => w.document.getElementById(id), () => { doneCalls += 1; });
	assert.equal(doneCalls, 1);
});

test("motion: the animation timings are positive constants", () => {
	assert.ok(SLIDE_MS > 0);
	assert.ok(LEAVE_MS > 0);
});
