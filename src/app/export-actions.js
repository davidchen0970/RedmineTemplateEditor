import {
    safe
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

export function setupExportActions({
    getState,
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
}
