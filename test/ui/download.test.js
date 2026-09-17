import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";

// download.js is browser-only (it clicks a real <a download>); stub the pieces
// jsdom can't do (URL.createObjectURL / anchor navigation) and observe the anchor.
test("download: triggerDownload wires a blob URL + filename and clicks once", async () => {
	const { w } = makeDom();
	const clicked = [];
	if (!globalThis.URL.createObjectURL) {
		globalThis.URL.createObjectURL = () => "blob:mock-download";
		globalThis.URL.revokeObjectURL = () => {};
	}
	const originalClick = w.HTMLAnchorElement.prototype.click;
	w.HTMLAnchorElement.prototype.click = function () {
		clicked.push(this);
	};
	try {
		const { triggerDownload } = await import("../../src/ui/io/download.js");
		triggerDownload("備註.textile", "h2. hi", "text/plain");

		assert.equal(clicked.length, 1, "the anchor is clicked exactly once");
		assert.equal(clicked[0].download, "備註.textile");
		assert.match(clicked[0].href, /^blob:/);
		assert.equal(w.document.querySelector("a"), null, "anchor is cleaned off the DOM");
	} finally {
		w.HTMLAnchorElement.prototype.click = originalClick;
	}
});
