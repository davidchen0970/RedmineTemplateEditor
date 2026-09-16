import { setupExportActions } from "./export-actions.js";
import { setupImportActions } from "./import-actions.js";
import { setupCopySections } from "./copy-sections.js";

export function setupFileActions(context) {
	setupExportActions(context);
	setupImportActions(context);
	setupCopySections(context);
}
