// Shared wiring for every app <dialog>: a click that lands on the dialog's own
// ::backdrop (reported by the browser as a click on the <dialog> element itself,
// not a child) dismisses it — like pressing Escape / a cancel control.
//
// `beforeClose` (optional) runs right before .close(), so a dialog can clear its
// pending action without running it (exactly like its Cancel button).
export function dismissOnBackdrop(dialog, beforeClose) {
	dialog.addEventListener("click", (event) => {
		if (event.target !== dialog) return;
		if (beforeClose) beforeClose();
		dialog.close();
	});
	return dialog;
}
