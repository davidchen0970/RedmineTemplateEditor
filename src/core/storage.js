import { createId, makeState, normalizeState } from "./model.js";

export const LEGACY_STORAGE_KEY = "redmine-template-editor:v4-output-first";

export function pageStoragePrefix() {
	const path = ([location.origin, location.pathname].join("").replace(/\/$/, "")) || "local-page";
	return LEGACY_STORAGE_KEY + ":page:" + encodeURIComponent(path);
}

export const DOCUMENT_INDEX_KEY = () => pageStoragePrefix() + ":documents";
export const ACTIVE_DOCUMENT_KEY = () => pageStoragePrefix() + ":activeDocument";
export const DEFAULT_DOCUMENT_ID = "default";

export function makeDocumentId() {
	return Date.now().toString(36) + "-" + createId();
}

export function safeDocumentName(name) {
	return String(name || "未命名").trim().replace(/\s+/g, " ").slice(0, 80) || "未命名";
}

export function documentStateKey(documentId = DEFAULT_DOCUMENT_ID) {
	return pageStoragePrefix() + ":state:" + documentId;
}

export function readDocumentIndex() {
	try {
		const documents = JSON.parse(localStorage.getItem(DOCUMENT_INDEX_KEY())) || [];
		return Array.isArray(documents) ? documents : [];
	} catch {
		return [];
	}
}

export function writeDocumentIndex(documents) {
	localStorage.setItem(DOCUMENT_INDEX_KEY(), JSON.stringify(documents, null, 2));
}

export function ensureDocumentIndex() {
	let documents = readDocumentIndex();
	if (!documents.length) {
		documents = [{ id: DEFAULT_DOCUMENT_ID, name: "預設文件", updatedAt: new Date().toISOString() }];
		writeDocumentIndex(documents);
	}
	return documents;
}

export function getActiveDocumentId() {
	const documents = ensureDocumentIndex();
	const saved = localStorage.getItem(ACTIVE_DOCUMENT_KEY());
	return documents.some((document) => document.id === saved) ? saved : documents[0].id;
}

export function setActiveDocumentId(documentId) {
	localStorage.setItem(ACTIVE_DOCUMENT_KEY(), documentId);
}

export function getActiveDocument() {
	const documents = ensureDocumentIndex();
	return documents.find((document) => document.id === getActiveDocumentId()) || documents[0];
}

export function renameDocument(documentId, name) {
	const documents = ensureDocumentIndex();
	const target = documents.find((document) => document.id === documentId);
	if (!target) return null;
	target.name = safeDocumentName(name);
	target.updatedAt = new Date().toISOString();
	writeDocumentIndex(documents);
	return target;
}

export function createDocument(name, initialState = makeState()) {
	const documents = ensureDocumentIndex();
	const documentId = makeDocumentId();
	const documentRecord = { id: documentId, name: safeDocumentName(name), updatedAt: new Date().toISOString() };
	documents.unshift(documentRecord);
	writeDocumentIndex(documents);
	setActiveDocumentId(documentId);
	saveState(initialState, documentId);
	return documentRecord;
}

export function deleteDocument(documentId) {
	let documents = ensureDocumentIndex();
	if (documents.length <= 1) return false;
	localStorage.removeItem(documentStateKey(documentId));
	documents = documents.filter((document) => document.id !== documentId);
	writeDocumentIndex(documents);
	if (getActiveDocumentId() === documentId) setActiveDocumentId(documents[0].id);
	return true;
}

export function loadState(documentId = getActiveDocumentId()) {
	try {
		const state = JSON.parse(localStorage.getItem(documentStateKey(documentId)));
		if (state) return normalizeState(state);
		if (documentId === DEFAULT_DOCUMENT_ID) {
			const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
			if (legacy) {
				const normalized = normalizeState(legacy);
				saveState(normalized, DEFAULT_DOCUMENT_ID);
				return normalized;
			}
		}
		return null;
	} catch {
		return null;
	}
}

export function saveState(state, documentId = getActiveDocumentId()) {
	state.updatedAt = new Date().toISOString();
	localStorage.setItem(documentStateKey(documentId), JSON.stringify(state, null, 2));
	const documents = ensureDocumentIndex();
	const target = documents.find((document) => document.id === documentId);
	if (target) {
		target.updatedAt = state.updatedAt;
		writeDocumentIndex(documents);
	}
}
