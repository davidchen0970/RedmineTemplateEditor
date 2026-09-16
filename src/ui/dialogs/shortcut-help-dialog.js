import { SHORTCUTS } from "../../app/keyboard-shortcuts.js";

let dialog = null;

function ensureDialog() {
	if (dialog) return dialog;
	dialog = document.createElement("dialog");
	dialog.id = "shortcutDialog";
	dialog.className = "add-block-dialog shortcut-dialog";
	const rows = SHORTCUTS
		.map(
			(shortcut) =>
				`<div class="shortcut-row"><kbd class="shortcut-keys">${shortcut.keys}</kbd><span class="shortcut-action">${shortcut.action}</span></div>`,
		)
		.join("");
	dialog.innerHTML = `
		<div class="dialog-head">快捷鍵</div>
		<div class="dialog-body">
			<div class="section-label">目前支援的快捷鍵</div>
			<div class="shortcut-list">${rows}</div>
			<p class="shortcut-note">按住 Ctrl（Mac 為 ⌘）+ Shift，再按對應的字母鍵。</p>
		</div>
		<div class="dialog-actions">
			<button type="button" id="shortcutClose" class="primary">關閉</button>
		</div>`;
	dialog.querySelector("#shortcutClose").onclick = () => dialog.close();
	document.body.appendChild(dialog);
	return dialog;
}

export function setupShortcutHelp() {
	const button = document.getElementById("shortcutHelp");
	if (!button) return;
	button.onclick = () => {
		const root = ensureDialog();
		root.showModal();
		root.querySelector("#shortcutClose").focus();
	};
}
