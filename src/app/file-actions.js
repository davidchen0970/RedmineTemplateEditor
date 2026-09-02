import { setupExportActions } from "./export-actions.js";
import { setupImportActions } from "./import-actions.js";

export function setupFileActions(context) {
    setupExportActions(context);
    setupImportActions(context);
}
