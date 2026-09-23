import { dismissOnBackdrop } from "./dismiss-on-backdrop.js";

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
				<button type="button" data-cancel>取消</button>
				<button type="submit" class="primary" data-confirm>確定</button>
			</div>
		</form>`;
	document.body.appendChild(dialog);
	dialog.querySelector("[data-cancel]").onclick = () => {
		pending = null;
		dialog.close();
	};
	dialog.querySelector("form").onsubmit = (event) => {
		event.preventDefault();
		const job = pending;
		pending = null;
		const value = dialog.querySelector("[data-value]").value;
		dialog.close();
		if (job) job(value);
	};
	// Clicking the backdrop dismisses like cancel (no confirm action runs).
	dismissOnBackdrop(dialog, () => {
		pending = null;
	});
	return dialog;
}

export function openPrompt({ heading, label, value = "", confirmLabel = "確定", onConfirm }) {
	if (typeof HTMLDialogElement === "undefined") {
		const typed = window.prompt(label, value);
		if (typed !== null) onConfirm(typed);
		return;
	}
	const box = ensure();
	box.querySelector("[data-head]").textContent = heading;
	box.querySelector("[data-label]").textContent = label;
	const input = box.querySelector("[data-value]");
	input.value = value;
	box.querySelector("[data-confirm]").textContent = confirmLabel;
	pending = onConfirm;
	box.showModal();
	input.focus();
	input.select();
}
