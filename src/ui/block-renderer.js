import { uid } from "../core/state.js";
import { ensureBlockContents } from "../textile/generator.js";
import { applyDefaults, createBlockElement, renderContents } from "./block-view.js";
import { getMaxBlockLevel, normalizeBlockLevel } from "./ui-state.js";

export function createBlockRenderer({
	getState,
	findSection,
	changed,
	renderAll
}) {
	function move(sectionId, blockId, direction) {
		const section = findSection(sectionId);
		const index = section.blocks.findIndex((item) => item.id === blockId);
		const target = index + direction;
		if (index < 0 || target < 0 || target >= section.blocks.length) return;
		[section.blocks[index], section.blocks[target]] = [section.blocks[target], section.blocks[index]];
		changed();
		renderAll();
	}

	function duplicate(sectionId, source) {
		const section = findSection(sectionId);
		const index = section.blocks.findIndex((item) => item.id === source.id);
		const copy = JSON.parse(JSON.stringify(source));
		copy.id = uid();
		if (getState().ui?.collapsed?.blocks) delete getState().ui.collapsed.blocks[copy.id];
		if (copy.type !== "plainText") copy.title = (copy.title || "") + " copy";
		section.blocks.splice(index + 1, 0, copy);
		changed();
		renderAll();
	}

	function bind(element, sectionId, block, maxLevel) {
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
		element.querySelector("[data-del]").onclick = () => {
			findSection(sectionId).blocks = findSection(sectionId).blocks.filter((item) => item.id !== block.id);
			changed();
			renderAll();
		};
		element.querySelector("[data-du]").onclick = () => duplicate(sectionId, block);
		element.querySelector("[data-add-content]").onclick = () => {
			block.contents.push("");
			changed();
			renderAll();
		};
		const showWork = element.querySelector("[data-show-work]");
		if (showWork) showWork.onchange = (event) => {
			block.showWorkPath = event.target.checked;
			changed();
		};
		element.querySelectorAll("[data-cont-index]").forEach((input) => input.oninput = (event) => {
			block.contents[Number(input.dataset.contIndex)] = event.target.value;
			ensureBlockContents(block);
			changed();
		});
		element.querySelectorAll("[data-del-content]").forEach((button) => button.onclick = () => {
			const index = Number(button.dataset.delContent);
			block.contents.length <= 1 ? block.contents[0] = "" : block.contents.splice(index, 1);
			ensureBlockContents(block);
			changed();
			renderAll();
		});
		element.querySelectorAll("[data-dup-content]").forEach((button) => button.onclick = () => {
			const index = Number(button.dataset.dupContent);
			block.contents.splice(index + 1, 0, block.contents[index] || "");
			ensureBlockContents(block);
			changed();
			renderAll();
		});
		const map = {
			work: "workPath",
			"work-title": "workPathTitle",
			lang: "codeLang",
			desc: "description"
		};
		Object.entries(map).forEach(([name, key]) => {
			const input = element.querySelector(`[data-${name}]`);
			if (input) input.oninput = (event) => {
				block[key] = event.target.value;
				changed();
			};
		});
	}

	function render(sectionId, block, index = 0, { open = false } = {}) {
		ensureBlockContents(block);
		const section = findSection(sectionId);
		const maxLevel = getMaxBlockLevel(section, index);
		block.level = normalizeBlockLevel(block.level, maxLevel);
		applyDefaults(block);
		const element = createBlockElement(block, maxLevel, { open });
		renderContents(element, block);
		bind(element, sectionId, block, maxLevel);
		return element;
	}
	return {
		render
	};
}
