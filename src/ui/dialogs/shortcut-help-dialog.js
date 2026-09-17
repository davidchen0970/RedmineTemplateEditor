import { SHORTCUTS } from "../../app/keyboard-shortcuts.js";
import { t } from "../../i18n.js";

let dialog = null;

function ensureDialog() {
	if (dialog) return dialog;
	dialog = document.createElement("dialog");
	dialog.id = "shortcutDialog";
	dialog.className = "add-block-dialog shortcut-dialog";
	dialog.innerHTML = `
		<div class="dialog-head"></div>
		<div class="dialog-body">
			<div class="section-label"></div>
			<div class="shortcut-list"></div>
			<p class="shortcut-note"></p>
		</div>
		<div class="dialog-actions">
			<button type="button" id="shortcutClose" class="primary"></button>
		</div>`;
	dialog.render = () => {
		dialog.querySelector(".dialog-head").textContent = t("settings.shortcuts");
		dialog.querySelector(".section-label").textContent = t("shortcut.label");
		dialog.querySelector(".shortcut-note").textContent = t("shortcut.note");
		dialog.querySelector("#shortcutClose").textContent = t("close");
		dialog.querySelector(".shortcut-list").innerHTML = SHORTCUTS.map(
			(shortcut) =>
				`<div class="shortcut-row"><kbd class="shortcut-keys">${shortcut.keys}</kbd><span class="shortcut-action">${escapeHtml(t(shortcut.actionKey))}</span></div>`,
		).join("");
	};
	dialog.querySelector("#shortcutClose").onclick = () => dialog.close();
	// Clicking the backdrop closes the dialog too.
	dialog.addEventListener("click", (event) => {
		if (event.target === dialog) dialog.close();
	});
	document.body.appendChild(dialog);
	return dialog;
}

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (c) =>
		({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
	);
}

export function setupShortcutHelp() {
	const button = document.getElementById("shortcutHelp");
	if (!button) return;
	button.onclick = () => {
		const root = ensureDialog();
		root.render();
		root.showModal();
		root.querySelector("#shortcutClose").focus();
	};
	document.addEventListener("i18n:change", () => {
		if (dialog) dialog.render();
	});
}
