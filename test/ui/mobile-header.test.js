// Header reorganization: the document toolbar pins into notes, the action buttons
// split into File (copy + transfer ops) and 更多 (reset + project link + 設定).
//
// NOTE: mobile-header.js runs its setup ONCE at import against whatever DOM exists
// then, so every structural assertion lives in a single test on that one DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../_dom.js";

const HEADER_HTML = `
	<div id="headerActions">
		<div class="storage-actions"><button id="storageNew">new</button></div>
		<button id="copy">Copy Textile</button>
		<button id="copySections">Copy Sections</button>
		<button id="txt">Download</button>
		<button id="json">Export JSON</button>
		<button id="import">Import JSON</button>
		<button id="patch">Import Patch</button>
		<button id="source_code">Source</button>
		<button id="reset">Reset</button>
	</div>
`;

test("header: reorganizes into notes / file / more with correct contents", async () => {
	const { w } = makeDom(HEADER_HTML);
	const { t } = await import("../../src/i18n.js");
	await import("../../src/ui/shell/mobile-header.js");

	const actions = w.document.getElementById("headerActions");
	// 1. Exactly the three expected groups exist.
	const names = Array.from(actions.querySelectorAll(".header-action-group"))
		.map((g) => g.dataset.headerActionGroup)
		.sort();
	assert.deepEqual(names, ["file", "more", "notes"]);
	assert.equal(actions.dataset.headerActionGroupsReady, "true");

	const group = (name) => actions.querySelector(`[data-header-action-group="${name}"]`);

	// 2. Document storage pins into notes.
	assert.ok(group("notes").querySelector(".storage-actions"));

	// 3. Copy + the transfer ops move under File.
	for (const id of ["copy", "copySections", "txt", "json", "import", "patch"]) {
		assert.ok(group("file").querySelector(`#${id}`), `#${id} should live in File`);
	}

	// 4. 更多 keeps only the project link + reset, and gains the 設定 opener.
	for (const id of ["reset", "source_code"]) {
		assert.ok(group("more").querySelector(`#${id}`), `#${id} should stay in 更多`);
	}
	const settingsOpen = group("more").querySelector("#settingsOpen");
	assert.ok(settingsOpen);
	assert.equal(settingsOpen.textContent, t("settings.open"));

	// 5. Every group starts collapsed.
	assert.equal(actions.querySelectorAll(".header-action-group.is-open").length, 0);
	const fileToggle = actions.querySelector('[data-header-action-group="file"] .header-action-group-toggle');
	assert.equal(fileToggle.getAttribute("aria-expanded"), "false");
});
