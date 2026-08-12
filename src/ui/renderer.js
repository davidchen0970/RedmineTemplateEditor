import { createFormRenderer } from "./form-renderer.js";
import { createBlockRenderer } from "./block-renderer.js";
import { createAddBlockDialog } from "./add-block-dialog.js";
import { createSectionRenderer } from "./section-renderer.js";
import { renderOutput } from "./output-view.js";
import { toast } from "./notifications.js";
import { addVerificationSnippet as appendVerificationSnippet } from "./verification-snippets.js";
export { label } from "./block-view.js";

export function createRenderer(context) {
	const {
		getState,
		getView,
		getExportStatus,
		getLastSaveText,
		changed,
		onPresetClick
	} = context;
	let sections;
	const renderOut = () => renderOutput(getState(), getView());
	const renderAll = (options) => render(options);
	const findSection = (id) => getState().sections.find((section) => section.id === id);
	const blocks = createBlockRenderer({
		getState,
		findSection,
		changed,
		renderAll
	});
	const dialog = createAddBlockDialog({
		findSection,
		changed,
		renderAll
	});
	const forms = createFormRenderer({
		getState,
		changed,
		onPresetClick,
		findSection,
		renderAll
	});
	sections = createSectionRenderer({
		getState,
		changed,
		renderAll,
		renderToggles: forms.renderToggles,
		renderOutput: renderOut,
		blockRenderer: blocks,
		addBlock: dialog.add
	});

	function renderSaveStatus() {
		const element = document.getElementById("save");
		const status = getExportStatus();
		if (element) {
			const lastSave = getLastSaveText() || "已自動儲存 --";
			const jsonStatus = `JSON ${status.json ? "已匯出" : "未匯出"}`;
			const txtStatus = `TXT ${status.txt ? "已匯出" : "未匯出"}`;
			element.textContent = [lastSave, jsonStatus, txtStatus].join(" · ");
		}
	}

	function render(options = {}) {
		forms.renderPresets();
		forms.renderFields();
		forms.renderToggles();
		sections.render(options);
		renderOut();
		renderSaveStatus();
	}

	function addVerificationSnippet(type) {
		appendVerificationSnippet(getState(), type);
		changed();
		render();
	}
	return {
		render,
		renderOut,
		renderSaveStatus,
		renderToggles: forms.renderToggles,
		toast,
		findSec: sections.find,
		addSection: sections.add,
		addVerificationSnippet
	};
}