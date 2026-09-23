import { dismissOnBackdrop } from "./dismiss-on-backdrop.js";
import { t } from "../../i18n.js";

let dialog = null;
let pending = null;

function ensure() {
	if (dialog) return dialog;
	dialog = document.createElement("dialog");
	dialog.className = "add-block-dialog";
	dialog.innerHTML = `
		<form method="dialog">
			<div class="dialog-head" data-head></div>
			<div class="dialog-body"><label class="field"><span data-label></span><input data-value type="text"></label></div>
			<div class="dialog-actions">
				<button type="button" data-cancel>${t("cancel")}</button>
				<button type="button" class="primary" data-confirm>${t("dialog.ok")}</button>
			</div>
		</form>`;
	document.body.appendChild(dialog);
	dialog.querySelector("[data-cancel]").textContent = t("cancel");
	dialog.querySelector("[data-cancel]").onclick = () => {
		pending = null;
		dialog.close();
	};
	const confirm = () => {
		const job = pending;
		pending = null;
		const value = dialog.querySelector("[data-value]").value;
		dialog.close();
		if (job) job(value);
	};
	dialog.querySelector("[data-confirm]").onclick = confirm;
	dialog.querySelector("form").onsubmit = (event) => {
		event.preventDefault();
		confirm();
	};
	// Clicking the backdrop dismisses like cancel (no confirm action runs).
	dismissOnBackdrop(dialog, () => {
		pending = null;
	});
	return dialog;
}

export function openPrompt({ heading, label, value = "", confirmLabel = t("dialog.ok"), onConfirm }) {
	if (typeof HTMLDialogElement === "undefined") {
		const typed = window.prompt(label, value);
		if (typed !== null) onConfirm(typed);
		return;
	}
	const box = ensure();
	box.querySelector("[data-head]").textContent = heading;
	box.querySelector("[data-label]").textContent = label;
	box.querySelector("[data-cancel]").textContent = t("cancel");
	const input = box.querySelector("[data-value]");
	input.value = value;
	box.querySelector("[data-confirm]").textContent = confirmLabel;
	pending = onConfirm;
	box.showModal();
	input.focus();
	input.select();
}
