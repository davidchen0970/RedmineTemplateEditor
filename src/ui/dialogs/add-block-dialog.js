import { block, createImplementationBlock } from "../../core/state.js";
import { BLOCK_TYPES, defaultTitle, label } from "../editor/block-view.js";
import { markEntering } from "../motion/card-stage.js";
import { blockCard } from "../dom/card.js";

const DESCRIPTIONS = {
	implementation: "工作路徑 + 多語言程式碼",
	text: "多段 Textile 內文",
	plainText: "無標題純文字",
	command: "一段終端機指令",
	diff: "程式碼差異對照",
	log: "執行日誌 / 記錄",
	mermaid: "Mermaid 流程圖",
	image: "嵌入一張圖片",
	collapse: "可收合的一段內容",
};

function describe(type) {
	return DESCRIPTIONS[type] || "";
}

export function createAddBlockDialog({ findSection, changed, renderAll }) {
	let pendingSectionId = null;
	let pendingIndex;
	let selectedType = "implementation";

	function insertionIndex(section) {
		if (typeof pendingIndex !== "number") return section.blocks.length;
		return Math.max(0, Math.min(pendingIndex, section.blocks.length));
	}

	function renderTypeCards(typeRoot, titleInput) {
		typeRoot.replaceChildren();
		for (const type of BLOCK_TYPES) {
			const card = document.createElement("div");
			card.className = "card" + (type === selectedType ? " active" : "");
			const strong = document.createElement("strong");
			strong.textContent = label(type);
			const span = document.createElement("span");
			span.textContent = describe(type);
			card.appendChild(strong);
			card.appendChild(span);
			card.onclick = () => {
				const staysOnPreviousDefault = titleInput.value === defaultTitle(selectedType);
				selectedType = type;
				if (staysOnPreviousDefault) titleInput.value = defaultTitle(type);
				renderTypeCards(typeRoot, titleInput);
			};
			typeRoot.appendChild(card);
		}
	}

	function add(sectionId, atIndex) {
		pendingIndex = typeof atIndex === "number" ? atIndex : undefined;
		if (typeof HTMLDialogElement === "undefined") {
			const type = prompt(`區塊類型：${BLOCK_TYPES.join(" / ")}`, "implementation") || "text";
			const title = prompt("區塊標題", defaultTitle(type)) || "";
			const targetSection = findSection(sectionId);
			const blockTitle = title || defaultTitle(type);
			const newBlock = type === "implementation"
				? createImplementationBlock(title || "api.c")
				: block(type, blockTitle, "");
			const target = insertionIndex(targetSection);
			targetSection.blocks.splice(target, 0, newBlock);
			newBlock.level = 1;
			changed();
			renderAll({ openBlockId: newBlock.id });
			return;
		}
		pendingSectionId = sectionId;
		const dialog = ensure();
		selectedType = "implementation";
		const typeRoot = dialog.querySelector("#abTypes");
		const title = dialog.querySelector("#abTitle");
		const level = dialog.querySelector("#abLevel");
		title.value = defaultTitle(selectedType);
		level.value = 1;
		renderTypeCards(typeRoot, title);
		dialog.showModal();
		title.focus();
		title.select();
	}

	function ensure() {
		let dialog = document.getElementById("abDialog");
		if (dialog) return dialog;
		dialog = document.createElement("dialog");
		dialog.id = "abDialog";
		dialog.className = "add-block-dialog";
		dialog.innerHTML = `
			<form method="dialog" id="abForm">
				<div class="dialog-head">新增區塊</div>
				<div class="dialog-body">
					<div class="section-label">區塊類型</div>
					<div class="template-list" id="abTypes"></div>
					<label class="field">區塊標題<input id="abTitle" type="text"></label>
					<label class="field">階層<input id="abLevel" type="number" min="1" step="1" value="1"></label>
				</div>
				<div class="dialog-actions">
					<button type="button" id="abCancel">取消</button>
					<button type="submit" class="primary">新增</button>
				</div>
			</form>`;
		document.body.appendChild(dialog);
		selectedType = "implementation";
		const typeRoot = dialog.querySelector("#abTypes");
		const title = dialog.querySelector("#abTitle");
		dialog.querySelector("#abCancel").onclick = () => {
			pendingSectionId = null;
			dialog.close();
		};
		dialog.querySelector("#abForm").onsubmit = (event) => {
			event.preventDefault();
			if (!pendingSectionId) return;
			const type = selectedType;
			const selectedTitle = title.value || defaultTitle(type);
			const section = findSection(pendingSectionId);
			const newBlock = type === "implementation"
				? createImplementationBlock(selectedTitle || "api.c")
				: block(type, selectedTitle, "");
			const target = insertionIndex(section);
			newBlock.level = Math.max(1, Math.floor(Number(dialog.querySelector("#abLevel").value) || 1));
			section.blocks.splice(target, 0, newBlock);
			pendingSectionId = null;
			pendingIndex = undefined;
			dialog.close();
			changed();
			renderAll({ openBlockId: newBlock.id });
			markEntering(newBlock.id, blockCard);
		};
		return dialog;
	}

	return { add };
}
