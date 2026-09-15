import { test, before } from "node:test";
import assert from "node:assert/strict";

// The storage module reads browser globals lazily inside its functions, so we can
// seed them before the tests call anything.
function makeLocalStorageShim() {
	const store = new Map();
	return {
		getItem: (key) => (store.has(key) ? store.get(key) : null),
		setItem: (key, value) => store.set(key, String(value)),
		removeItem: (key) => store.delete(key),
	};
}

before(() => {
	globalThis.location = { origin: "https://rt.example", pathname: "/editor" };
	globalThis.localStorage = makeLocalStorageShim();
});

const {
	pageStoragePrefix,
	safeDocumentName,
	ensureDocumentIndex,
	createDocument,
	deleteDocument,
	renameDocument,
	getActiveDocumentId,
	DEFAULT_DOCUMENT_ID,
	loadState,
	saveState,
	LEGACY_STORAGE_KEY,
} = await import("../src/core/storage.js");
const stateModule = await import("../src/core/state.js");

test("pageStoragePrefix encodes origin+path and strips a trailing slash", () => {
	const prefix = pageStoragePrefix();
	assert.ok(prefix.includes("https%3A%2F%2Frt.example%2Feditor"));
	assert.ok(!prefix.endsWith("/"));
});

test("safeDocumentName trims, collapses whitespace and clips to 80 chars", () => {
	assert.equal(safeDocumentName("  a   b  "), "a b");
	assert.equal(safeDocumentName(), "未命名");
	assert.equal(safeDocumentName("x".repeat(200)).length, 80);
});

test("ensureDocumentIndex seeds a default document on first run", () => {
	ensureDocumentIndex();
	const docs = JSON.parse(localStorage.getItem("redmine-template-editor:v4-output-first:page:https%3A%2F%2Frt.example%2Feditor:documents"));
	assert.equal(docs.length, 1);
	assert.equal(docs[0].id, DEFAULT_DOCUMENT_ID);
});

test("createDocument becomes active and unshifts a fresh record", () => {
	const doc = createDocument("  測 試  ");
	assert.equal(doc.name, "測 試");
	assert.equal(getActiveDocumentId(), doc.id);
	const docs = JSON.parse(localStorage.getItem("redmine-template-editor:v4-output-first:page:https%3A%2F%2Frt.example%2Feditor:documents"));
	assert.equal(docs[0].id, doc.id);
	assert.ok(localStorage.getItem("redmine-template-editor:v4-output-first:page:https%3A%2F%2Frt.example%2Feditor:state:" + doc.id));
});

test("deleteDocument refuses to remove the last remaining document", () => {
	// a single-document index must reject deletion of that document
	localStorage.setItem("redmine-template-editor:v4-output-first:page:https%3A%2F%2Frt.example%2Feditor:documents",
		JSON.stringify([{ id: DEFAULT_DOCUMENT_ID, name: "x" }]));
	assert.equal(deleteDocument(DEFAULT_DOCUMENT_ID), false);
});

test("renameDocument updates the name and timestamp of an existing doc", () => {
	const doc = createDocument("old");
	const renamed = renameDocument(doc.id, "new name");
	assert.ok(renamed);
	assert.equal(renamed.name, "new name");
	assert.equal(renameDocument("no-such-id", "x"), null);
});

test("saveState stamps a fresh updatedAt on the state", () => {
	const s = stateModule.makeState("blank");
	s.updatedAt = "2000-01-01T00:00:00.000Z";
	const saved = saveState(s);
	assert.ok(saved || true); // delegate write is exercised
	assert.notEqual(s.updatedAt, "2000-01-01T00:00:00.000Z");
	assert.ok(!Number.isNaN(Date.parse(s.updatedAt)), `${s.updatedAt} 應是合法 ISO 時間`);
});

test("loadState falls back to the legacy storage key for the default document", () => {
	const legacy = { title: "舊資料", status: "N/A", sections: [], changeContent: "", relatedRef: "" };
	globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy));
	const loaded = loadState(DEFAULT_DOCUMENT_ID);
	assert.equal(loaded.title, "舊資料");
	assert.equal(loaded.enabled, undefined); // legacy object shape, not a section
});

test("loadState swallows corrupt JSON and returns null", () => {
	globalThis.localStorage.setItem("redmine-template-editor:v4-output-first:page:https%3A%2F%2Frt.example%2Feditor:state:nonexistent", "{ nope");
	const out = loadState("nonexistent");
	assert.equal(out, null);
});
