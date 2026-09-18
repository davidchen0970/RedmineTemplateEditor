import { test } from "node:test";
import assert from "node:assert/strict";

const { buildDiffUnits } = await import("../../src/ui/dialogs/add-block-dialog.js");

test("buildDiffUnits turns each selected patch file into an implementation block", () => {
	const units = buildDiffUnits([
		{ name: "sensor.c", folder: "src/core", content: "diff src" },
		{ name: "main.c", folder: ".", content: "diff main" },
	], 2);

	assert.equal(units.length, 2);
	assert.equal(units[0].type, "implementation");
	assert.equal(units[0].title, "sensor.c");
	assert.equal(units[0].workPath, "src/core");
	assert.equal(units[0].level, 2);
	assert.equal(units[0].contents[0].lang, "diff");
	assert.equal(units[0].contents[0].content, "diff src");
	assert.equal(units[1].workPath, ".");
});
