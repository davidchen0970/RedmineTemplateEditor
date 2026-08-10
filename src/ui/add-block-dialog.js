import { block, impl } from "../core/state.js";
import { BLOCK_TYPES, defaultTitle, label } from "./block-view.js";
export function createAddBlockDialog({
	findSection,
	changed,
	renderAll
}) {
	let pendingSectionId = null;

	function add(sectionId) {
		if (typeof HTMLDialogElement === "undefined") {
			const type = prompt(`區塊類型：${BLOCK_TYPES.join(" / ")}`, "implementation") || "text";
			const title = prompt("區塊標題", defaultTitle(type)) || "";
			const targetSection = findSection(sectionId);
			const blockTitle = title || defaultTitle(type);
			const newBlock = type === "implementation" 
				? impl(title || "api.c") 
				: block(type, blockTitle, "");

			targetSection.blocks.push(newBlock);
			changed();
			renderAll();
			return;
		}
		pendingSectionId = sectionId;
		const dialog = ensure();
		const type = dialog.querySelector("#addBlockType");
		const title = dialog.querySelector("#addBlockTitle");
		type.value = "implementation";
		title.value = defaultTitle(type.value);
		dialog.showModal();
		title.focus();
		title.select();
	}

	function ensure() {
		let dialog = document.getElementById("addBlockDialog");
		if (dialog) return dialog;
		dialog = document.createElement("dialog");
		dialog.id = "addBlockDialog";
		dialog.className = "add-block-dialog";
		dialog.innerHTML = `
			<form method="dialog" id="addBlockForm">
				<div class="dialog-head">新增區塊</div>
				<div class="dialog-body">
					<div class="field">
						<label>區塊類型</label>
						<select id="addBlockType">
							${BLOCK_TYPES.map((type) => `
								<option value="${type}">${label(type)}</option>
							`).join("")}
						</select>
					</div>
					<div class="field">
						<label>區塊標題</label>
						<input id="addBlockTitle" type="text">
					</div>
				</div>
				<div class="dialog-actions">
					<button type="button" id="addBlockCancel">取消</button>
					<button type="submit" class="primary">新增</button>
				</div>
			</form>`;
		document.body.appendChild(dialog);
		const type = dialog.querySelector("#addBlockType");
		const title = dialog.querySelector("#addBlockTitle");
		type.onchange = () => title.value = defaultTitle(type.value);
		dialog.querySelector("#addBlockCancel").onclick = () => {
			pendingSectionId = null;
			dialog.close();
		};
		dialog.querySelector("#addBlockForm").onsubmit = (event) => {
			event.preventDefault();
			if (!pendingSectionId) return;
			const selectedType = type.value || "text";
			const selectedTitle = title.value || defaultTitle(selectedType);
			const section = findSection(pendingSectionId);
			const newBlock = selectedType === "implementation" 
				? impl(selectedTitle || "api.c") 
				: block(selectedType, selectedTitle, "");

			section.blocks.push(newBlock);
			pendingSectionId = null;
			dialog.close();
			changed();
			renderAll();
		};
		return dialog;
	}
	return {
		add
	};
}
