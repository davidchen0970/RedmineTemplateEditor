import { block, createImplementationBlock, DEFAULT_CODE_LANG } from "../../core/state.js";
import { BLOCK_TYPES, defaultTitle, label } from "../editor/block-view.js";
import { markEntering } from "../motion/card-stage.js";
import { dismissOnBackdrop } from "./dismiss-on-backdrop.js";
import { blockCard } from "../dom/card.js";
import { splitPatch } from "../../app/import-actions.js";
import { applyStaticText, t } from "../../i18n.js";

const IMPL_EXTRAS = [
	{ n: "workPathTitle", label: "block.workPathTitle", kind: "text", def: "work path" },
	{ n: "workPath", label: "block.workPath", kind: "textarea", def: "(docker)$ pwd" },
	{ n: "description", label: "Description", kind: "textarea", def: "" },
	{ n: "showWorkPath", label: "block.showWorkPath", kind: "checkbox", def: true },
];

// Per type: `main` fields render fully, `extra` folds behind a "block.more" collapsible.
const TYPE_FIELDS = {
	implementation: {
		main: [
			{ n: "lang", label: "block.lang", kind: "text", def: DEFAULT_CODE_LANG },
			{ n: "content", label: "block.content", kind: "textarea", def: "" },
		],
		extra: IMPL_EXTRAS,
	},
	image: {
		main: [{ n: "content", label: "block.imageUrl", kind: "text", def: "" }],
		extra: [],
	},
	diff: {
		main: [
			{ n: "diffFile", label: "block.diffFile", kind: "file", accept: ".diff,.patch,.txt", def: "" },
			{ n: "content", label: "block.diffFallback", kind: "textarea", def: "" },
		],
		extra: [],
	},
};

const DEFAULT_FIELDS = {
	main: [{ n: "content", label: "block.content", kind: "textarea", def: "" }],
	extra: [],
};

const DESCRIPTIONS = {
	implementation: "blockdesc.implementation",
	text: "blockdesc.text",
	plainText: "blockdesc.plainText",
	command: "blockdesc.command",
	diff: "blockdesc.diff",
	log: "blockdesc.log",
	mermaid: "blockdesc.mermaid",
	image: "blockdesc.image",
	collapse: "blockdesc.collapse",
};

function fieldsFor(type) {
	return TYPE_FIELDS[type] || DEFAULT_FIELDS;
}

export function createAddBlockDialog({ findSection, changed, renderAll }) {
	let pendingSectionId = null;
	let pendingIndex;
	let selectedType = "implementation";
	let pendingDiffFiles = [];

	function insertionIndex(section) {
		if (typeof pendingIndex !== "number") return section.blocks.length;
		return Math.max(0, Math.min(pendingIndex, section.blocks.length));
	}

	function makeField(field) {
		const wrapper = document.createElement("label");
		wrapper.className = "field";
		const caption = document.createElement("span");
		caption.textContent = t(field.label);
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
		title.placeholder = isPlain ? t("block.titleUnavailable") : "";
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
		if (fileInput) {
			fileInput.onchange = () => {
				const file = fileInput.files && fileInput.files[0];
				if (!file) return;
				const reader = new FileReader();
				reader.onload = () => {
					pendingDiffFiles = splitPatch(reader.result).map((item) => ({ ...item, selected: true }));
					renderDiffPreview(dialog);
				};
				reader.readAsText(file);
				fileInput.value = "";
			};
		}
		renderDiffPreview(dialog);
	}

	function renderDiffPreview(dialog) {
		const root = dialog.querySelector("#abDiffPreview");
		if (!root) return;
		const show = selectedType === "diff" && pendingDiffFiles.length > 0;
		root.hidden = !show;
		if (!show) { root.replaceChildren(); return; }
		root.replaceChildren();
		for (const item of pendingDiffFiles) {
			const row = document.createElement("div");
			row.className = "note" + (item.selected ? "" : " nd-unused");
			row.dataset.abDiff = item.folder === "." ? item.name : `${item.folder}/${item.name}`;
			const pick = document.createElement("label");
			pick.className = "pick";
			const box = document.createElement("input");
			box.type = "checkbox";
			box.checked = item.selected;
			box.onchange = () => {
				item.selected = box.checked;
				row.classList.toggle("nd-unused", !box.checked);
			};
			const path = document.createElement("span");
			path.className = "path";
			path.textContent = item.name;
			pick.append(box, path);
			const body = document.createElement("div");
			body.className = "diff-body";
			body.textContent = item.folder === "." ? item.name : `${item.folder}/${item.name}`;
			body.title = item.content;
			row.append(pick, body);
			root.appendChild(row);
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
			caption.textContent = DESCRIPTIONS[type] ? t(DESCRIPTIONS[type]) : "";
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
				<div class="dialog-head" data-i18n="section.addBlock"></div>
				<div class="dialog-body">
					<div class="section-label" data-i18n="block.type"></div>
					<div class="template-list" id="abTypes"></div>
					<label class="field" id="abTitleWrap"><span data-i18n="block.title"></span><input id="abTitle" type="text"></label>
					<div id="abMain"></div>
					<div id="abDiffPreview" hidden></div>
					<details id="abExtraWrap">
						<summary class="field-collapse" data-i18n="block.more"></summary>
						<div id="abExtra"></div>
					</details>
					<label class="field"><span data-i18n="block.level"></span><input id="abLevel" type="number" min="1" step="1" value="1"></label>
				</div>
				<div class="dialog-actions">
					<button type="button" id="abCancel" data-i18n="cancel"></button>
					<button type="submit" class="primary" data-i18n="add"></button>
				</div>
			</form>`;
		document.body.appendChild(dialog);
		// Keep a live dialog localised even if the language is toggled while it is open.
		document.addEventListener("i18n:change", () => {
			if (!dialog.open) return;
			applyStaticText(dialog);
			renderTypeCards(dialog.querySelector("#abTypes"), dialog);
			renderFields(dialog);
		});
		const typeRoot = dialog.querySelector("#abTypes");
		selectedType = "implementation";
		dialog.querySelector("#abCancel").onclick = () => {
			pendingSectionId = null;
			dialog.close();
		};
		// Clicking the backdrop closes the dialog like Cancel (no block is added).
		dismissOnBackdrop(dialog, () => {
			pendingSectionId = null;
		});
		dialog.querySelector("#abForm").onsubmit = (event) => {
			event.preventDefault();
			if (!pendingSectionId) return;
			const type = selectedType;
			const title = dialog.querySelector("#abTitle").value || defaultTitle(type);
			const section = findSection(pendingSectionId);
			const level = Math.max(1, Math.floor(Number(dialog.querySelector("#abLevel").value) || 1));
			const chosen = pendingDiffFiles.filter((item) => item.selected);
			if (type === "diff" && chosen.length) {
				let target = insertionIndex(section);
				let openId = null;
				for (const unit of buildDiffUnits(chosen, level)) {
					section.blocks.splice(target, 0, unit);
					target += 1;
					openId = unit.id;
				}
				pendingDiffFiles = [];
				pendingSectionId = null;
				pendingIndex = undefined;
				dialog.close();
				changed();
				renderAll({ openBlockId: openId });
				markEntering(openId, blockCard);
				return;
			}
			const newBlock = buildBlock(dialog, type, title);
			newBlock.level = level;
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
		pendingDiffFiles = [];
		if (typeof HTMLDialogElement === "undefined") {
			const type = prompt(`${t("block.type")}：${BLOCK_TYPES.join(" / ")}`, "implementation") || "text";
			const title = prompt(t("block.title"), defaultTitle(type)) || "";
			const content = prompt(t("block.content")) || "";
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
		applyStaticText(dialog);
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

// Pure mapping for the new-block "diff" preview: selected patch files become
// one implementation block each (title=file name, workPath=folder, diff content).
export function buildDiffUnits(chosen, level) {
	return chosen.map((item) => {
		const unit = createImplementationBlock(item.name, item.folder, "diff", item.content);
		unit.level = level;
		return unit;
	});
}
