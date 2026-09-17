import { block, createImplementationBlock, DEFAULT_CODE_LANG } from "../../core/state.js";
import { BLOCK_TYPES, defaultTitle, label } from "../editor/block-view.js";
import { markEntering } from "../motion/card-stage.js";
import { dismissOnBackdrop } from "./dismiss-on-backdrop.js";
import { blockCard } from "../dom/card.js";

const IMPL_EXTRAS = [
	{ n: "workPathTitle", label: "工作路徑標題", kind: "text", def: "work path" },
	{ n: "workPath", label: "工作路徑", kind: "textarea", def: "(docker)$ pwd" },
	{ n: "description", label: "Description", kind: "textarea", def: "" },
	{ n: "showWorkPath", label: "顯示工作路徑", kind: "checkbox", def: true },
];

// Per type: `main` fields render fully, `extra` folds behind a "其他" collapsible.
const TYPE_FIELDS = {
	implementation: {
		main: [
			{ n: "lang", label: "語言", kind: "text", def: DEFAULT_CODE_LANG },
			{ n: "content", label: "內容", kind: "textarea", def: "" },
		],
		extra: IMPL_EXTRAS,
	},
	image: {
		main: [{ n: "content", label: "圖片網址", kind: "text", def: "" }],
		extra: [],
	},
	diff: {
		main: [
			{ n: "diffFile", label: "上傳 diff / patch", kind: "file", accept: ".diff,.patch,.txt", def: "" },
			{ n: "content", label: "或直接貼上內容", kind: "textarea", def: "" },
		],
		extra: [],
	},
};

const DEFAULT_FIELDS = {
	main: [{ n: "content", label: "內容", kind: "textarea", def: "" }],
	extra: [],
};

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

function fieldsFor(type) {
	return TYPE_FIELDS[type] || DEFAULT_FIELDS;
}

export function createAddBlockDialog({ findSection, changed, renderAll }) {
	let pendingSectionId = null;
	let pendingIndex;
	let selectedType = "implementation";

	function insertionIndex(section) {
		if (typeof pendingIndex !== "number") return section.blocks.length;
		return Math.max(0, Math.min(pendingIndex, section.blocks.length));
	}

	function makeField(field) {
		const wrapper = document.createElement("label");
		wrapper.className = "field";
		const caption = document.createElement("span");
		caption.textContent = field.label;
		const control = document.createElement(field.kind === "textarea" ? "textarea" : "input");
		if (field.kind === "checkbox") {
			control.type = "checkbox";
			if (field.def) control.checked = true;
		} else if (field.kind === "file") {
			control.type = "file";
			control.accept = field.accept || "";
		} else if (field.kind !== "textarea") {
			control.type = "text";
		}
		if (field.kind !== "checkbox" && field.kind !== "file") control.value = field.def || "";
		if (field.kind === "textarea") control.className = "content-editor";
		control.setAttribute("data-ab", field.n);
		wrapper.appendChild(caption);
		wrapper.appendChild(control);
		return wrapper;
	}

	function reads(dialog, name) {
		const control = dialog.querySelector(`[data-ab="${name}"]`);
		if (!control) return undefined;
		if (control.type === "checkbox") return control.checked;
		return control.value.trim();
	}

	function renderFields(dialog) {
		const fields = fieldsFor(selectedType);
		const title = dialog.querySelector("#abTitle");
		const isPlain = selectedType === "plainText";
		title.disabled = isPlain;
		title.placeholder = isPlain ? "標題不可用" : "";
		title.value = isPlain ? "" : defaultTitle(selectedType);

		const mainRoot = dialog.querySelector("#abMain");
		mainRoot.replaceChildren();
		for (const field of fields.main) mainRoot.appendChild(makeField(field));

		const extraWrap = dialog.querySelector("#abExtraWrap");
		const extraRoot = dialog.querySelector("#abExtra");
		extraRoot.replaceChildren();
		extraWrap.hidden = fields.extra.length === 0;
		for (const field of fields.extra) extraRoot.appendChild(makeField(field));

		const fileInput = dialog.querySelector('[data-ab="diffFile"]');
		const target = dialog.querySelector('[data-ab="content"]');
		if (fileInput && target) {
			fileInput.onchange = () => {
				const file = target && fileInput.files && fileInput.files[0];
				if (!file) return;
				const reader = new FileReader();
				reader.onload = () => { target.value = String(reader.result || ""); };
				reader.readAsText(file);
			};
		}
	}

	function renderTypeCards(typeRoot, dialog) {
		typeRoot.replaceChildren();
		for (const type of BLOCK_TYPES) {
			const card = document.createElement("div");
			card.className = "card" + (type === selectedType ? " active" : "");
			card.dataset.abType = type;
			const strong = document.createElement("strong");
			strong.textContent = label(type);
			const caption = document.createElement("span");
			caption.textContent = DESCRIPTIONS[type] || "";
			card.appendChild(strong);
			card.appendChild(caption);
			card.onclick = () => {
				selectedType = type;
				renderFields(dialog);
				renderTypeCards(typeRoot, dialog);
			};
			typeRoot.appendChild(card);
		}
	}

	function buildBlock(dialog, type, title) {
		if (type === "implementation") {
			return createImplementationBlock(
				title,
				reads(dialog, "workPath") || "(docker)$ pwd",
				reads(dialog, "lang") || DEFAULT_CODE_LANG,
				reads(dialog, "content") || "",
				reads(dialog, "description") || "",
				reads(dialog, "workPathTitle") || "work path",
				reads(dialog, "showWorkPath") !== false,
			);
		}
		return block(type, title, reads(dialog, "content") || "");
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
					<label class="field" id="abTitleWrap">區塊標題<input id="abTitle" type="text"></label>
					<div id="abMain"></div>
					<details id="abExtraWrap">
						<summary class="field-collapse">其他</summary>
						<div id="abExtra"></div>
					</details>
					<label class="field">階層<input id="abLevel" type="number" min="1" step="1" value="1"></label>
				</div>
				<div class="dialog-actions">
					<button type="button" id="abCancel">取消</button>
					<button type="submit" class="primary">新增</button>
				</div>
			</form>`;
		document.body.appendChild(dialog);
		const typeRoot = dialog.querySelector("#abTypes");
		selectedType = "implementation";
		dialog.querySelector("#abCancel").onclick = () => {
			pendingSectionId = null;
			dialog.close();
		};
		// Clicking the backdrop closes the dialog like 取消 (no block is added).
		dismissOnBackdrop(dialog, () => {
			pendingSectionId = null;
		});
		dialog.querySelector("#abForm").onsubmit = (event) => {
			event.preventDefault();
			if (!pendingSectionId) return;
			const type = selectedType;
			const title = dialog.querySelector("#abTitle").value || defaultTitle(type);
			const section = findSection(pendingSectionId);
			const newBlock = buildBlock(dialog, type, title);
			newBlock.level = Math.max(1, Math.floor(Number(dialog.querySelector("#abLevel").value) || 1));
			const target = insertionIndex(section);
			section.blocks.splice(target, 0, newBlock);
			pendingSectionId = null;
			pendingIndex = undefined;
			dialog.close();
			changed();
			renderAll({ openBlockId: newBlock.id });
			markEntering(newBlock.id, blockCard);
		};
		renderTypeCards(typeRoot, dialog);
		renderFields(dialog);
		return dialog;
	}

	function add(sectionId, atIndex) {
		pendingIndex = typeof atIndex === "number" ? atIndex : undefined;
		if (typeof HTMLDialogElement === "undefined") {
			const type = prompt(`區塊類型：${BLOCK_TYPES.join(" / ")}`, "implementation") || "text";
			const title = prompt("區塊標題", defaultTitle(type)) || "";
			const content = prompt("內容") || "";
			const targetSection = findSection(sectionId);
			const newBlock = type === "implementation"
				? createImplementationBlock(title || "api.c", undefined, DEFAULT_CODE_LANG, content)
				: block(type, title, content);
			newBlock.level = 1;
			const target = insertionIndex(targetSection);
			targetSection.blocks.splice(target, 0, newBlock);
			changed();
			renderAll({ openBlockId: newBlock.id });
			return;
		}
		pendingSectionId = sectionId;
		const dialog = ensure();
		renderFields(dialog);
		dialog.querySelector("#abLevel").value = 1;
		dialog.showModal();
		const titleInput = dialog.querySelector("#abTitle");
		if (!titleInput.disabled) {
			titleInput.focus();
			titleInput.select();
		}
	}

	return { add };
}
