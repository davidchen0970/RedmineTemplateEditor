import { t } from "../../i18n.js";
import { dismissOnBackdrop } from "./dismiss-on-backdrop.js";

// Settings dialog: hosts the three true-settings controls (language, dark mode,
// keyboard shortcuts). Each control sits in its own labeled row so the dialog reads
// like a real settings sheet. It reuses the shared .add-block-dialog chrome
// (head / body / actions / backdrop) for consistent look with the other dialogs.
const ROWS = [
	{ id: "langToggle", key: "settings.lang" },
	{ id: "themeToggle", key: "settings.theme" },
	{ id: "blockLevelToggle", key: "settings.blockLevel" },
	{ id: "shortcutHelp", key: "settings.shortcuts" },
];

let dialog = null;

export function setupSettingsDialog(rows = ROWS) {
	if (dialog) return dialog;

	dialog = document.createElement("dialog");
	dialog.className = "settings-dialog add-block-dialog";

	const form = document.createElement("form");
	form.method = "dialog";

	const head = document.createElement("div");
	head.className = "dialog-head";
	head.textContent = t("settings.heading");

	const body = document.createElement("div");
	body.className = "dialog-body";
	body.classList.add("settings-body");

	rows.forEach(({ id, key }) => {
		const el = document.getElementById(id);
		if (!el) return;

		const row = document.createElement("div");
		row.className = "settings-row";

		const title = document.createElement("div");
		title.className = "settings-row-title";
		title.dataset.settingsKey = key;
		title.textContent = t(key);

		const control = document.createElement("div");
		control.className = "settings-row-control";
		control.appendChild(el);

		row.append(title, control);
		body.appendChild(row);
	});

	const actions = document.createElement("div");
	actions.className = "dialog-actions";
	const close = document.createElement("button");
	close.value = "close";
	close.textContent = t("close");
	actions.appendChild(close);

	form.append(head, body, actions);
	dialog.appendChild(form);
	document.body.appendChild(dialog);

	// Clicking the backdrop closes the settings dialog.
	dismissOnBackdrop(dialog);

	// Open when the (lazily created) #settingsOpen button is clicked.
	document.addEventListener("click", (event) => {
		if (event.target.closest("#settingsOpen")) dialog.showModal();
	});

	const refresh = () => {
		dialog.querySelectorAll(".dialog-head").forEach((h) => {
			h.textContent = t("settings.heading");
		});
		dialog.querySelectorAll(".dialog-actions button").forEach((b) => {
			b.textContent = t("close");
		});
		dialog.querySelectorAll("[data-settings-key]").forEach((titleEl) => {
			titleEl.textContent = t(titleEl.dataset.settingsKey);
		});
		const open = document.getElementById("settingsOpen");
		if (open) open.textContent = t("settings.open");
	};
	document.addEventListener("i18n:change", refresh);
	return dialog;
}
