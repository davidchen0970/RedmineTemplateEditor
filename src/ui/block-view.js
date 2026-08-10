import { esc } from "../core/state.js";
export const BLOCK_TYPES = ["implementation", "text", "plainText", "command", "diff", "log", "mermaid", "image", "collapse"];

export function label(type) {
    return ({
        implementation: "Implementation Unit",
        text: "Text / Textile",
        plainText: "純文字（無標題）",
        command: "Command Block",
        diff: "Diff Block",
        log: "Log Block",
        mermaid: "Mermaid Block",
        image: "Image",
        collapse: "Collapse"
    })[type] || type;
}

export function defaultTitle(type) {
    return type === "implementation" ? "api.c" : type === "plainText" ? "" : label(type);
}

export function applyDefaults(block) {
    if (block.type === "implementation") {
        block.title ||= "api.c";
        block.workPath ||= "(docker)$ pwd";
        block.workPathTitle ||= "work path";
        block.codeLang ||= "cpp";
    }
}

function options(selected) {
    return BLOCK_TYPES.map((type) => 
        `<option value="${type}" ${selected === type ? "selected" : ""}>${label(type)}</option>`
    ).join("");
}

export function createBlockElement(block, maxLevel) {
    const element = document.createElement("div");
    element.className = "block";
    const showWorkChecked = block.showWorkPath !== false ? "checked" : "";
    const workTitle = esc(block.workPathTitle || "work path");
    const workPath = esc(block.workPath || "(docker)$ pwd");
    const codeLang = esc(block.codeLang || "cpp");
    const description = esc(block.description || "");

    const implementation = block.type === "implementation" ? `
        <div class="grid-2">
            <label class="field">
                <div class="field-header">
                    <span>輸出 work path</span>
                    <input id="workPath" type="checkbox" data-show-work ${showWorkChecked}>
                </div>
                <input data-work-title value="${workTitle}">
                <textarea data-work>${workPath}</textarea>
            </label>
            <label class="field">主要內容語言 class<input data-lang value="${codeLang}"></label>
        </div>
        <label class="field">Description<textarea data-desc>${description}</textarea></label>
    ` : "";
    const blockTypeOptions = options(block.type);
    const blockLevel = block.level || 1;
    const blockTitle = esc(block.title || "");
    const blockTypeLabel = label(block.type);
    element.innerHTML = `
        <div class="actions block-actions">
            <span class="note">${blockTypeLabel}</span>
            <span>
                <button class="small" data-bup>上移</button>
                <button class="small" data-bdown>下移</button>
                <button class="small" data-du>複製</button>
                <button class="small danger" data-del>刪除</button>
            </span>
        </div>
        <div class="grid-2">
            <label class="field">區塊類型<select data-btype>${blockTypeOptions}</select></label>
            <label class="field block-level-field">所在層級<input data-blevel type="number" min="1" max="${maxLevel}" step="1" value="${blockLevel}"></label>
        </div>
        <label class="field">區塊標題<input data-btitle value="${blockTitle}"></label>
        ${implementation}
        <div data-contents></div>
        <button class="small primary" data-add-content>新增 content</button>
    `;

    return element;
}

export function renderContents(element, block) {
    const root = element.querySelector("[data-contents]");
    root.replaceChildren();
    block.contents.forEach((content, index) => {
        const item = document.createElement("div");
        item.className = "block block-content";
        const contentClass = block.type === "implementation" ? "content-editor-large" : "content-editor";
        const escapedContent = esc(content);

        item.innerHTML = `
            <div class="actions block-actions">
                <span class="note">content #${index + 1}</span>
                <span>
                    <button class="small" data-dup-content="${index}">複製</button>
                    <button class="small danger" data-del-content="${index}">刪除</button>
                </span>
            </div>
            <label class="field">
                內容
                <textarea data-cont-index="${index}" class="${contentClass}">${escapedContent}</textarea>
            </label>
        `;
        
        root.appendChild(item);
    });
}