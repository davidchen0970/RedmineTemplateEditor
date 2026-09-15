import { test } from "node:test";
import assert from "node:assert/strict";
import { splitPatch, elide } from "../../src/app/import-actions.js";

const SAMPLE_DIFF = `diff --git a/src/editor/block-view.js b/src/editor/block-view.js
index 111..222 100644
--- a/src/editor/block-view.js
+++ b/src/editor/block-view.js
@@ -1,5 +1,6 @@
-console.log("old");
+console.log("new");
diff --git a/test/api_test.c b/test/api_test.c
new file mode 100644
--- /dev/null
+++ b/test/api_test.c
@@ -0,0 +1 @@
+int test(void) { return 0; }`;

test("splitPatch splits at each diff --git header and names/labels each file", () => {
	const files = splitPatch(SAMPLE_DIFF);
	assert.equal(files.length, 2);
	assert.deepEqual(
		files.map((f) => f.name),
		["block-view.js", "api_test.c"],
	);
	assert.deepEqual(files.map((f) => f.folder), ["src/editor", "test"]);
});

test("splitPatch keeps the full chunk body as content", () => {
	const [first] = splitPatch(SAMPLE_DIFF);
	assert.match(first.content, /diff --git a\/src\/editor\/block-view\.js/);
	assert.match(first.content, /@@ -1,5 \+1,6 @@/);
	assert.match(first.content, /console\.log\("old"\);/);
});

test("splitPatch returns [] for empty, null, or non-diff text", () => {
	assert.deepEqual(splitPatch(""), []);
	assert.deepEqual(splitPatch("no diff header at all"), []);
	assert.deepEqual(splitPatch(undefined), []);
	assert.deepEqual(splitPatch(null), []);
});

test("splitPatch uses the b/ side name and last folder for a rename", () => {
	const out = splitPatch(
		"diff --git a/src/old_name.c b/src/new_name.c\nsimilarity index 100%\nrename from src/old_name.c\nrename to src/new_name.c\n",
	);
	assert.equal(out[0].name, "new_name.c");
	assert.equal(out[0].folder, "src");
});

test("splitPatch ignores trailing non-empty lines that are not diff files", () => {
	// a preamble with a lone diff line but no a/..b/ pair yields nothing
	const out = splitPatch("diff --git a/only b/\n+ x\n");
	assert.equal(out.length, 0);
});

test("elide keeps names at or under the max unchanged", () => {
	assert.equal(elide("api.c"), "api.c");
	assert.equal(elide("x".repeat(22)), "x".repeat(22));
});

test("elide truncates a long name to keep max-1 chars including the ellipsis", () => {
	const long = "this_is_a_very_long_file_name_for_the_export.png"; // 46 chars
	const cut = elide(long, 22);
	assert.ok(cut.length <= 22);
	assert.ok(cut.includes("…"));
	assert.ok(long.startsWith(cut.slice(0, cut.indexOf("…"))));

	const cutDefault = elide(long); // default max 22
	assert.ok(cutDefault.length <= 22);
	assert.ok(cutDefault.includes("…"));
	assert.notEqual(cutDefault, long);
});
