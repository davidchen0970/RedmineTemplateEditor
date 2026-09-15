let dialog = null;
let pendingAction = null;

function ensure() {
	if (dialog) return dialog;
	dialog = document.createElement("dialog");
	dialog.className = "add-block-dialog";
	dialog.innerHTML = `
		<form method="dialog">
			<div class="dialog-head" data-head></div>
			<div class="dialog-body"><p data-text></p></div>
			<div class="dialog-actions">
				<button type="button" data-cancel>取消</button>
				<button type="button" class="primary" data-confirm>確認</button>
			</div>
		</form>`;
	document.body.appendChild(dialog);
	dialog.querySelector("[data-cancel]").onclick = () => {
		pendingAction = null;
		dialog.close();
	};
	dialog.querySelector("[data-confirm]").onclick = () => {
		const action = pendingAction;
		pendingAction = null;
		dialog.close();
		if (action) action();
	};
	return dialog;
}

export function confirmDelete({ heading, text, onConfirm, confirmLabel = "確認" }) {
	if (typeof HTMLDialogElement === "undefined") {
		if (window.confirm(text)) onConfirm();
		return;
	}
	const box = ensure();
	box.querySelector("[data-head]").textContent = heading;
	box.querySelector("[data-text]").textContent = text;
	box.querySelector("[data-confirm]").textContent = confirmLabel;
	pendingAction = onConfirm;
	box.showModal();
}
