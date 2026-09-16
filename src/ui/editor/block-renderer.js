import { createId, DEFAULT_CODE_LANG } from "../../core/state.js";
import { ensureBlockContents } from "../../textile/generator.js";
import { applyDefaults, createBlockElement, renderContents } from "./block-view.js";
import { getMaxBlockLevel, normalizeBlockLevel } from "./ui-state.js";
import { slideReorder } from "../motion/card-slide.js";
import { markEntering, markLeaving } from "../motion/card-stage.js";
import { confirmDelete } from "../dialogs/confirm-dialog.js";
import { blockCard } from "../dom/card.js";

export function createBlockRenderer({
	getState,
	findSection,
	changed,
	renderAll,
	addBlock
}) {
	function move(sectionId, blockId, direction) {
		const section = findSection(sectionId);
		const index = section.blocks.findIndex((item) => item.id === blockId);
		const target = index + direction;
		if (index < 0 || target < 0 || target >= section.blocks.length) return;
		const locate = blockCard;
		const play = slideReorder([section.blocks[index].id, section.blocks[target].id], locate);
		[section.blocks[index], section.blocks[target]] = [section.blocks[target], section.blocks[index]];
		changed();
		renderAll();
		play();
	}

	// 區塊「其他」使用掛在 document.body 的共用 popup，逃離 .block 的 transform 層疊／裁切上下文。
	let morePopup = null;
	let moreAnchorId = null;

	function getMorePopup() {
		if (morePopup) return morePopup;
		morePopup = document.createElement("div");
		morePopup.className = "more-popup";
		morePopup.hidden = true;
		document.body.appendChild(morePopup);
		document.addEventListener("click", (event) => {
			if (!morePopup.hidden && !event.target.closest("[data-block-more]") && !morePopup.contains(event.target)) {
				morePopup.hidden = true;
				morePopup.replaceChildren();
				moreAnchorId = null;
			}
		});
		return morePopup;
	}

	function moreItem(label, danger, onClick) {
		const button = document.createElement("button");
		button.type = "button";
		if (danger) button.className = "danger";
		button.textContent = label;
		button.onclick = () => { onClick(); morePopup.hidden = true; morePopup.replaceChildren(); moreAnchorId = null; };
		return button;
	}

	function showLabel(sectionId, blockId) {
		const found = (findSection(sectionId)?.blocks || []).find((item) => item.id === blockId);
		return found ? (found.title || found.type || "") : "";
	}

	function doDelete(sectionId, blockId) {
		markLeaving(blockId, blockCard, () => {
			findSection(sectionId).blocks = findSection(sectionId).blocks.filter((item) => item.id !== blockId);
			changed();
			renderAll();
		});
	}

	function askDelete(sectionId, blockId) {
		confirmDelete({
			heading: "刪除區塊",
			text: `刪除區塊「${showLabel(sectionId, blockId)}」？`,
			confirmLabel: "刪除",
			onConfirm: () => doDelete(sectionId, blockId),
		});
	}

	function openMore(toggle, sectionId, blockId) {
		const popup = getMorePopup();
		if (!popup.hidden && moreAnchorId === blockId) {
			popup.hidden = true;
			popup.replaceChildren();
			moreAnchorId = null;
			return;
		}
		moreAnchorId = blockId;
		const section = findSection(sectionId);
		const index = section ? section.blocks.findIndex((item) => item.id === blockId) : -1;
		popup.replaceChildren(
			moreItem("在區塊前新增區塊", false, () => addBlock(sectionId, index)),
			moreItem("在區塊後新增區塊", false, () => addBlock(sectionId, index + 1)),
			moreItem("複製", false, () => duplicate(sectionId, findSection(sectionId).blocks.find((b) => b.id === blockId))),
			moreItem("刪除", true, () => askDelete(sectionId, blockId)),
		);
		const rect = toggle.getBoundingClientRect();
		popup.hidden = false;
		popup.classList.remove("mo-pop");
		void popup.offsetWidth;
		popup.classList.add("mo-pop");
		popup.style.left = (rect.right - popup.offsetWidth) + "px";
		popup.style.top = (rect.bottom + 4) + "px";
	}

	function duplicate(sectionId, source) {
		const section = findSection(sectionId);
		const index = section.blocks.findIndex((item) => item.id === source.id);
		const copy = JSON.parse(JSON.stringify(source));
		copy.id = createId();
		if (getState().ui?.collapsed?.blocks) delete getState().ui.collapsed.blocks[copy.id];
		if (copy.type !== "plainText") copy.title = (copy.title || "") + " copy";
		section.blocks.splice(index + 1, 0, copy);
		changed();
		renderAll();
		markEntering(copy.id, blockCard);
	}

	function bind(element, sectionId, block, maxLevel, index = 0) {
		element.querySelector("[data-block-more]").onclick = (event) => openMore(event.currentTarget, sectionId, block.id);
		element.querySelector("[data-btype]").onchange = (event) => {
			block.type = event.target.value;
			applyDefaults(block);
			changed();
			renderAll({
				openBlockId: block.id
			});
		};
		element.querySelector("[data-btitle]").oninput = (event) => {
			block.title = event.target.value;
			changed();
		};
		element.querySelector("[data-blevel]").oninput = (event) => {
			block.level = normalizeBlockLevel(event.target.value, maxLevel);
			event.target.value = block.level;
			changed();
			renderAll();
		};
		element.querySelector("[data-bup]").onclick = () => move(sectionId, block.id, -1);
		element.querySelector("[data-bdown]").onclick = () => move(sectionId, block.id, 1);
		element.querySelector("[data-add-content]").onclick = () => {
			block.contents.push(block.type === "implementation" ? { content: "", lang: DEFAULT_CODE_LANG } : "");
			changed();
			renderAll();
		};
		const showWork = element.querySelector("[data-show-work]");
		if (showWork) showWork.onchange = (event) => {
			block.showWorkPath = event.target.checked;
			const fields = element.querySelector("[data-work-fields]");
			if (fields) fields.hidden = !event.target.checked;
			changed();
		};
		element.querySelectorAll("[data-cont-index]").forEach((input) => input.oninput = (event) => {
			const index = Number(input.dataset.contIndex);
			if (block.type === "implementation") block.contents[index] = { ...block.contents[index], content: event.target.value };
			else block.contents[index] = event.target.value;
			ensureBlockContents(block);
			changed();
		});
		element.querySelectorAll("[data-del-content]").forEach((button) => button.onclick = () => {
			const index = Number(button.dataset.delContent);
			if (block.contents.length <= 1) {
				block.contents[0] = block.type === "implementation" ? { content: "", lang: DEFAULT_CODE_LANG } : "";
			} else {
				block.contents.splice(index, 1);
			}
			ensureBlockContents(block);
			changed();
			renderAll();
		});
		element.querySelectorAll("[data-dup-content]").forEach((button) => button.onclick = () => {
			const index = Number(button.dataset.dupContent);
			const source = block.contents[index];
			const copy = (typeof source === "object" ? { content: source.content, lang: source.lang } : source);
			block.contents.splice(index + 1, 0, copy);
			ensureBlockContents(block);
			changed();
			renderAll();
		});
		element.querySelectorAll("[data-cont-lang]").forEach((input) => input.oninput = (event) => {
			const index = Number(input.dataset.contLang);
			if (block.type === "implementation") block.contents[index] = { ...block.contents[index], lang: event.target.value };
			changed();
		});
		const map = {
			work: "workPath",
			"work-title": "workPathTitle",
			desc: "description"
		};
		const workTitleInput = element.querySelector("[data-work-title]");
		if (workTitleInput) workTitleInput.oninput = (event) => {
			block.workPathTitle = event.target.value;
			const label = element.querySelector("[data-work-label]");
			if (label) label.textContent = event.target.value || "work path";
			changed();
		};
		Object.entries(map).forEach(([name, key]) => {
			if (name === "work-title") return;
			const input = element.querySelector(`[data-${name}]`);
			if (input) input.oninput = (event) => {
				block[key] = event.target.value;
				changed();
			};
		});
	}

	function render(sectionId, block, index = 0, { open = false, onToggle = null } = {}) {
		ensureBlockContents(block);
		const section = findSection(sectionId);
		const maxLevel = getMaxBlockLevel(section, index);
		block.level = normalizeBlockLevel(block.level, maxLevel);
		applyDefaults(block);
		const element = createBlockElement(block, maxLevel, { open, onToggle });
		element.dataset.block = block.id;
		renderContents(element, block);
		bind(element, sectionId, block, maxLevel, index);
		return element;
	}
	return {
		render
	};
}
