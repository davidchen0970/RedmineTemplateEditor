import {
    documentStateKey,
    createImplementationBlock,
    makeState,
    normalizeState,
    safe,
    createSection
} from "../core/state.js";
import {
    textile
} from "../textile/generator.js";

function download(filename, text, type) {
    const anchor = document.createElement("a");
    const url = URL.createObjectURL(new Blob([text], {
        type
    }));
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function parsePatch(text) {
    return String(text || "").split(/^diff --git /m).filter(Boolean)
        .map((part) => "diff --git " + part)
        .map((chunk) => {
            const match = chunk.match(/^diff --git\s+a\/(.+?)\s+b\/(.+?)\s*$/m);
            const path = match ? match[2] : "patch.diff";
            return createImplementationBlock(path.split("/").pop(), path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".", "diff", chunk.trim());
        }).filter((unit) => unit.content);
}

export function setupFileActions({
    getState,
    setState,
    getActiveId,
    changed,
    renderer,
    setExportStatus
}) {
    document.getElementById("copy").onclick = async () => {
        const state = getState();
        const output = textile(state);
        try {
            await navigator.clipboard.writeText(output);
            download(safe(state.title) + ".json", JSON.stringify(state, null, 2), "application/json");
        } catch {
            document.getElementById("out").select();
            document.execCommand("copy");
        }
        renderer.toast("已複製 Redmine Textile, 強制儲存至 JSON file");
        setExportStatus("json");
    };
    document.getElementById("txt").onclick = () => {
        const state = getState();
        download(safe(state.title) + ".textile", textile(state), "text/plain");
        setExportStatus("txt");
    };
    document.getElementById("json").onclick = () => {
        const state = getState();
        download(safe(state.title) + ".json", JSON.stringify(state, null, 2), "application/json");
        setExportStatus("json");
    };
    document.getElementById("import").onclick = () => document.getElementById("file").click();
    document.getElementById("file").onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const value = JSON.parse(reader.result);
                if (!value.environment || !Array.isArray(value.sections)) throw Error("格式不符合");
                setState(normalizeState(value));
                changed();
                renderer.render();
                renderer.toast("JSON 已匯入");
            } catch (error) {
                alert("JSON 匯入失敗：" + error.message);
            }
        };
        reader.readAsText(file);
        event.target.value = "";
    };
    document.getElementById("patch").onclick = () => document.getElementById("patchFile").click();
    document.getElementById("patchFile").onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const units = parsePatch(reader.result);
            if (!units.length) return alert("Patch 匯入失敗：找不到 diff 區塊");
            const state = getState();
            let section = state.sections.find((item) => item.title === "實作流程");
            if (!section) {
                section = createSection("實作流程", true);
                state.sections.push(section);
            }
            section.enabled = true;
            section.blocks.push(...units);
            changed();
            renderer.render();
            renderer.toast(`已匯入 ${units.length} 個 Implementation Unit`);
        };
        reader.readAsText(file);
        event.target.value = "";
    };
    document.getElementById("reset").onclick = () => {
        if (!confirm("清除目前文件並重設？")) return;
        localStorage.removeItem(documentStateKey(getActiveId()));
        setState(makeState());
        changed();
        renderer.render();
    };
}