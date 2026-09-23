import { createFormRenderer } from "./form-renderer.js";
import { createBlockRenderer } from "./block-renderer.js";
import { createAddBlockDialog } from "../dialogs/add-block-dialog.js";
import { createSectionRenderer } from "./section-renderer.js";
import { renderOutput } from "../output/output-view.js";
import { toast, showPatchProgress, hidePatchProgress } from "../shell/notifications.js";
import { addVerificationSnippet as appendVerificationSnippet } from "../formatting/verification-snippets.js";
import { t } from "../../i18n.js";
export { label } from "./block-view.js";

export function createRenderer(context) {
	const {
		getState,
		getView,
		getExportStatus,
		getLastSaveText,
		changed,
		onPresetClick,
		getShowLevel
	} = context;
	let sections;
	const renderOut = () => renderOutput(getState(), getView());
	const renderAll = (options) => render(options);
	const findSection = (sectionId) => getState().sections.find((section) => section.id === sectionId);
	const dialog = createAddBlockDialog({
		findSection,
		changed,
		renderAll
	});
	const blocks = createBlockRenderer({
		getState,
		findSection,
		changed,
		renderAll,
		addBlock: dialog.add,
		getShowLevel
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
			const lastSave = getLastSaveText() || t("status.saveDefault");
			const jsonStatus = `JSON ${status.json ? t("status.exported") : t("status.notExported")}`;
			const txtStatus = `TXT ${status.txt ? t("status.exported") : t("status.notExported")}`;
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
		showPatchProgress,
		hidePatchProgress,
		findSec: sections.find,
		addSection: sections.add,
		addVerificationSnippet
	};
}