import { escapeHtml } from "../../core/state.js";
import { t } from "../../i18n.js";
export const BLOCK_TYPES = ["implementation", "text", "plainText", "command", "diff", "log", "mermaid", "image", "collapse"];

export function label(type) {
	const map = {
		implementation: "blocktype.implementation",
		text: "blocktype.text",
		plainText: "blocktype.plainText",
		command: "blocktype.command",
		diff: "blocktype.diff",
		log: "blocktype.log",
		mermaid: "blocktype.mermaid",
		image: "blocktype.image",
		collapse: "blocktype.collapse",
	};
	return map[type] ? t(map[type]) : type;
}

export function titleDisabled(type) {
	return type === "plainText";
}

export function defaultTitle(type) {
	return ({
		implementation: "api.c",
		text: "",
		plainText: "",
		command: t("blocktitle.command"),
		diff: "",
		log: t("blocktitle.log"),
		mermaid: t("blocktitle.mermaid"),
		image: "",
		collapse: t("blocktitle.collapse"),
	})[type] ?? "";
}

export function applyDefaults(block) {
	if (block.type === "implementation") {
		block.title ||= "api.c";
		block.workPath ||= "(docker)$ pwd";
		block.workPathTitle ||= t("block.workPath");
	}
}

function options(selected) {
	return BLOCK_TYPES.map((type) => 
		`<option value="${type}" ${selected === type ? "selected" : ""}>${label(type)}</option>`
	).join("");
}

export function createBlockElement(block, maxLevel, { open = false, onToggle = null } = {}) {
	const element = document.createElement("div");
	element.className = "block";
	const showWorkChecked = block.showWorkPath !== false ? "checked" : "";
	const workTitle = escapeHtml(block.workPathTitle || t("block.workPath"));
	const workPath = escapeHtml(block.workPath || "(docker)$ pwd");
	const description = escapeHtml(block.description || "");

	const implementation = block.type === "implementation" ? `
		<label class="field">
			<div class="field-header">
				<span data-work-label>${workTitle || "work path"}</span>
				<input id="workPath" type="checkbox" data-show-work ${showWorkChecked}>
			</div>
			<div class="work-path-fields" data-work-fields ${block.showWorkPath === false ? "hidden" : ""}>
				<input data-work-title value="${workTitle}">
				<textarea data-work>${workPath}</textarea>
			</div>
		</label>
		<label class="field">Description<textarea data-desc>${description}</textarea></label>
	` : "";
	const blockTypeOptions = options(block.type);
	const blockLevel = block.level || 1;
	const blockTitle = escapeHtml(block.title || "");
	const blockTypeLabel = label(block.type);
	element.innerHTML = `
		<div class="actions block-actions block-summary">
			<button class="block-collapse-toggle" type="button" data-block-toggle aria-expanded="${String(open)}">
				<span class="block-collapse-icon" aria-hidden="true">▾</span>
				<span class="block-summary-title" title="${blockTitle || t("block.untitled")}">${blockTitle || t("block.untitled")}</span>
				<span class="block-summary-meta">
					<span class="block-summary-separator" aria-hidden="true">|</span>
					<span class="block-type-label">${escapeHtml(blockTypeLabel)}</span>
				</span>
			</button>
			<span>
				<button class="small" data-bup>${t("up")}</button>
				<button class="small" data-bdown>${t("down")}</button>
				<button class="small" data-block-more>${t("block.more")} ▾</button>
			</span>
		</div>
		<div class="block-collapsible" data-block-collapsible>
		<div class="grid-2">
			<label class="field">${t("block.type")}<select data-btype>${blockTypeOptions}</select></label>
			<label class="field block-level-field">${t("block.level")}<input data-blevel type="number" min="1" max="${maxLevel}" step="1" value="${blockLevel}"></label>
		</div>
		<label class="field">${t("block.title")}<input data-btitle value="${blockTitle}" ${titleDisabled(block.type) ? "disabled" : ""}></label>
		${implementation}
		<div data-contents></div>
		<button class="small primary" data-add-content>${t("block.addContent")}</button>
		</div>
	`;

	const toggle = element.querySelector("[data-block-toggle]");
	const collapsible = element.querySelector("[data-block-collapsible]");

	function setOpen(nextOpen) {
		element.classList.toggle("is-collapsed", !nextOpen);
		collapsible.hidden = !nextOpen;
		toggle.setAttribute("aria-expanded", String(nextOpen));
	}

	setOpen(open);
	toggle.addEventListener("click", () => {
		const nextOpen = toggle.getAttribute("aria-expanded") !== "true";
		setOpen(nextOpen);
		if (onToggle) onToggle(nextOpen);
	});

	return element;
}

export function renderContents(element, block) {
	const root = element.querySelector("[data-contents]");
	root.replaceChildren();
	const isImpl = block.type === "implementation";
	block.contents.forEach((content, index) => {
		const item = document.createElement("div");
		item.className = "block block-content";
		const contentClass = isImpl ? "content-editor-large" : "content-editor";
		const contentText = isImpl ? escapeHtml(content?.content ?? "") : escapeHtml(content);
		const langField = isImpl
			? `<label class="field content-lang-field">${t("block.lang")}<input data-cont-lang="${index}" value="${escapeHtml(content?.lang || "")}"></label>`
			: "";

		item.innerHTML = `
			<div class="actions block-actions">
				<span class="note">${t("block.contentLabel")} #${index + 1}</span>
				<span>
					<button class="small" data-dup-content="${index}">${t("copy")}</button>
					<button class="small danger" data-del-content="${index}">${t("delete")}</button>
				</span>
			</div>
			${langField}
			<label class="field">
				${t("block.content")}
				<textarea data-cont-index="${index}" class="${contentClass}">${contentText}</textarea>
			</label>
		`;
		
		root.appendChild(item);
	});
}
