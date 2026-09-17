import { sectionsTextile } from "../textile/generator.js";
import { dismissOnBackdrop } from "../ui/dialogs/dismiss-on-backdrop.js";

export function setupCopySections({ getState, renderer }) {
	document.getElementById("copySections").onclick = () => {
		copySections(getState(), renderer);
	};
}

// The section picker is a lazy singleton <dialog>, reusing the shared
// "add-block-dialog" shell/styling that prompt-dialog.js also uses.
let boxRef = null;
// Resolves the in-flight picker promise; null once the dialog is closed/resolved.
let resolveSelected = null;

function ensureDialog() {
	if (boxRef) return boxRef;
	boxRef = document.createElement("dialog");
	boxRef.className = "add-block-dialog";
	boxRef.innerHTML = `
		<form method="dialog">
			<div class="dialog-head">複製段落</div>
			<div class="dialog-body" data-list></div>
			<div class="dialog-actions">
				<button type="button" data-all>全選</button>
				<button type="button" data-cancel>取消</button>
				<button type="button" class="primary" data-confirm>複製</button>
			</div>
		</form>`;
	document.body.appendChild(boxRef);
	// Escape or the cancel button both close the dialog -> treat as "no selection".
	boxRef.addEventListener("close", () => {
		const settle = resolveSelected;
		resolveSelected = null;
		if (settle) settle([]);
	});
	boxRef.querySelector("[data-cancel]").onclick = () => boxRef.close();
	// Clicking the backdrop closes the dialog too (treats as no selection).
	dismissOnBackdrop(boxRef);
	return boxRef;
}

async function copySections(state, renderer) {
	const sections = (state.sections || []).filter((section) => section && section.id);
	if (typeof HTMLDialogElement === "undefined" || !sections.length) {
		if (!sections.length) {
			renderer.toast("沒有可複製的段落");
			return;
		}
		await writeClipboard(sectionsTextile(sections), renderer, sections.length);
		return;
	}

	const box = ensureDialog();
	const list = box.querySelector("[data-list]");
	list.replaceChildren();
	const checks = sections.map((section) => {
		const label = document.createElement("label");
		label.className = "note";
		const chk = document.createElement("input");
		chk.type = "checkbox";
		chk.checked = section.enabled;
		label.append(chk, " ", section.title || "(未命名段落)");
		list.appendChild(label);
		return chk;
	});
	box.querySelector("[data-all]").onclick = () => {
		const checkAll = checks.some((chk) => !chk.checked);
		checks.forEach((chk) => { chk.checked = checkAll; });
	};
	box.querySelector("[data-confirm]").onclick = () => {
		const selected = sections.filter((_, index) => checks[index].checked);
		// Clear the resolver first so the "close" event below does not settle twice.
		const settle = resolveSelected;
		resolveSelected = null;
		box.close();
		if (settle) settle(selected);
	};

	const selected = await new Promise((resolve) => { resolveSelected = resolve; box.showModal(); });
	if (!selected.length) {
		renderer.toast("已取消複製段落");
		return;
	}
	await writeClipboard(sectionsTextile(selected), renderer, selected.length);
}

async function writeClipboard(text, renderer, count) {
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		const box = document.createElement("textarea");
		box.value = text;
		box.style.position = "fixed";
		box.style.opacity = "0";
		document.body.appendChild(box);
		box.focus();
		box.select();
		document.execCommand("copy");
		box.remove();
	}
	renderer.toast(`已複製 ${count} 個段落`);
}
