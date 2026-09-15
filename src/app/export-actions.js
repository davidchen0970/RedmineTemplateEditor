import { safe } from "../core/state.js";
import { textile } from "../textile/generator.js";
import { triggerDownload } from "../ui/io/download.js";

export function setupExportActions({ getState, renderer, setExportStatus }) {
	document.getElementById("copy").onclick = async () => {
		const state = getState();
		const output = textile(state);
		try {
			await navigator.clipboard.writeText(output);
			triggerDownload(safe(state.title) + ".json", JSON.stringify(state, null, 2), "application/json");
		} catch {
			document.getElementById("out").select();
			document.execCommand("copy");
		}
		renderer.toast("已複製 Textile，並同時儲存成 JSON 檔案");
		setExportStatus("json");
	};
	document.getElementById("txt").onclick = () => {
		const state = getState();
		triggerDownload(safe(state.title) + ".textile", textile(state), "text/plain");
		setExportStatus("txt");
	};
	document.getElementById("json").onclick = () => {
		const state = getState();
		triggerDownload(safe(state.title) + ".json", JSON.stringify(state, null, 2), "application/json");
		setExportStatus("json");
	};
}
