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

function asciiCompare(a, b) {
    const left = String(a || "");
    const right = String(b || "");
    const length = Math.min(left.length, right.length);
    for (let i = 0; i < length; i++) {
        const diff = left.charCodeAt(i) - right.charCodeAt(i);
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
        const docs = ensureDocumentIndex().sort((a, b) => asciiCompare(a.name, b.name));
        select.replaceChildren(...docs.map((doc) => {
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = doc.name || "未命名";
            return option;
        }));
        select.value = getActiveId();
        if (document.activeElement !== nameInput) {
            nameInput.value = docs.find((doc) => doc.id === getActiveId())?.name || "";
        }
    };

    const activate = (id, message) => {
        setActiveDocumentId(id);
        const nextState = normalizeState(loadState(id)) || makeState();
        setDocument(id, nextState, message);
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
        const doc = renameDocument(getActiveId(), nameInput.value);
        renderPicker();
        renderer.toast(doc ? "名稱已更新" : "找不到目前文件");
    };
    newBtn.onclick = () => {
        const current = getState();
        const name = prompt("新文件名稱", current.title || "新文件") || "新文件";
        const nextState = makeState(current.noteType || "porting");
        nextState.title = name;
        const doc = createDocument(name, nextState);
        activate(doc.id, "已建立 " + doc.name);
    };
    deleteBtn.onclick = () => {
        const doc = getActiveDocument();
        if (!doc || !confirm(`刪除 localStorage 文件「${doc.name}」？`)) return;
        if (!deleteDocument(getActiveId())) {
            renderer.toast("至少需要保留一份文件");
            return;
        }
        activate(getActiveDocumentId(), "已刪除文件");
    };

    renderPicker();
    return renderPicker;
}