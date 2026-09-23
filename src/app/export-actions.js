import { safe } from "../core/state.js";
import { textile } from "../textile/generator.js";
import { triggerDownload } from "../ui/io/download.js";
import { t } from "../i18n.js";

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
		renderer.toast(t("toast.exportCopied"));
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
