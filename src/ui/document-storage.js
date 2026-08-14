import {
    createDocument,
    deleteDocument,
    ensureDocumentIndex,
    getActiveDocument,
    getActiveDocumentId,
    loadState,
    makeState,
    normalizeState,
    renameDocument,
    setActiveDocumentId,
} from "../core/state.js";

function asciiCompare(leftValue, rightValue) {
    const left = String(leftValue || "");
    const right = String(rightValue || "");
    const length = Math.min(left.length, right.length);
    for (let characterIndex = 0; characterIndex < length; characterIndex++) {
        const diff = left.charCodeAt(characterIndex) - right.charCodeAt(characterIndex);
        if (diff !== 0) return diff;
    }
    return left.length - right.length;
}

export function setupDocumentStorage({
    getState,
    getActiveId,
    setDocument,
    renderer
}) {
    const select = document.getElementById("storageDocSelect");
    const nameInput = document.getElementById("storageDocName");
    const newBtn = document.getElementById("storageNew");
    const renameBtn = document.getElementById("storageRename");
    const deleteBtn = document.getElementById("storageDelete");
    if (!select || !nameInput || !newBtn || !renameBtn || !deleteBtn) return () => {};

    const renderPicker = () => {
        const documents = ensureDocumentIndex().sort((leftDocument, rightDocument) => asciiCompare(leftDocument.name, rightDocument.name));
        select.replaceChildren(...documents.map((documentRecord) => {
            const option = document.createElement("option");
            option.value = documentRecord.id;
            option.textContent = documentRecord.name || "未命名";
            return option;
        }));
        select.value = getActiveId();
        if (document.activeElement !== nameInput) {
            nameInput.value = documents.find((documentRecord) => documentRecord.id === getActiveId())?.name || "";
        }
    };

    const activate = (documentId, message) => {
        setActiveDocumentId(documentId);
        const nextState = normalizeState(loadState(documentId)) || makeState();
        setDocument(documentId, nextState, message);
        renderer.render();
        renderPicker();
        renderer.toast(message);
    };

    select.onchange = () => {
        if (select.value && select.value !== getActiveId()) {
            activate(select.value, "已讀取 " + (getActiveDocument()?.name || "文件"));
        }
    };
    nameInput.onkeydown = (event) => {
        if (event.key === "Enter") renameBtn.click();
    };
    renameBtn.onclick = () => {
        const documentRecord = renameDocument(getActiveId(), nameInput.value);
        renderPicker();
        renderer.toast(documentRecord ? "名稱已更新" : "找不到目前文件");
    };
    newBtn.onclick = () => {
        const current = getState();
        const name = prompt("新文件名稱", current.title || "新文件") || "新文件";
        const nextState = makeState(current.noteType || "porting");
        nextState.title = name;
        const documentRecord = createDocument(name, nextState);
        activate(documentRecord.id, "已建立 " + documentRecord.name);
    };
    deleteBtn.onclick = () => {
        const documentRecord = getActiveDocument();
        if (!documentRecord || !confirm(`刪除 localStorage 文件「${documentRecord.name}」？`)) return;
        if (!deleteDocument(getActiveId())) {
            renderer.toast("至少需要保留一份文件");
            return;
        }
        activate(getActiveDocumentId(), "已刪除文件");
    };

    renderPicker();
    return renderPicker;
}