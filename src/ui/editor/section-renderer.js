import { escapeHtml, createSection, createId } from "../../core/state.js";
import { isCollapsed, ensureUiState, getMaxBlockLevel, normalizeBlockLevel } from "./ui-state.js";
import { slideReorder } from "../motion/card-slide.js";
import { markEntering, markLeaving } from "../motion/card-stage.js";
import { confirmDelete } from "../dialogs/confirm-dialog.js";
import { openPrompt } from "../dialogs/prompt-dialog.js";
import { sectionCard } from "../dom/card.js";
import { t } from "../../i18n.js";
export function createSectionRenderer({
	getState,
	changed,
	renderAll,
	renderToggles,
	renderOutput,
	blockRenderer,
	addBlock
}) {
	const find = (sectionId) => getState().sections.find((section) => section.id === sectionId);
	const locate = sectionCard;

	function add(title = t("section.newDefault")) {
		openPrompt({
			heading: t("section.newHeading"),
			label: t("section.titleLabel"),
			value: title,
			confirmLabel: t("add"),
			onConfirm: (value) => {
				const section = createSection(value || title, true);
				getState().sections.push(section);
				changed();
				renderAll();
				markEntering(section.id, locate);
			},
		});
	}

	function duplicate(sectionId) {
		const state = getState(),
			target = find(sectionId);
		if (!target) return;
		const copy = JSON.parse(JSON.stringify(target));
		copy.id = createId();
		copy.title = (copy.title || t("section.newDefault")) + t("section.copySuffix");
		copy.blocks = (copy.blocks || []).map((item) => ({
			...item,
			id: createId()
		}));
		const index = state.sections.findIndex((item) => item.id === sectionId);
		state.sections.splice(index + 1, 0, copy);
		changed();
		renderAll();
		markEntering(copy.id, locate);
	}

	// state 需在 onConfirm 時另行讀取（dialog 是異步回的）
	function remove(sectionId) {
		const state = getState(),
			section = find(sectionId);
		if (!section) return;
		confirmDelete({
			heading: t("section.delete"),
			text: t("section.delText", { name: section.title }),
			confirmLabel: t("delete"),
			onConfirm: () => {
				const current = find(sectionId);
				if (!current) return;
				markLeaving(sectionId, locate, () => {
					const live = getState();
					live.sections = live.sections.filter((item) => item.id !== sectionId);
					if (live.ui?.collapsed?.sections) delete live.ui.collapsed.sections[sectionId];
					changed();
					renderAll();
				});
			},
		});
	}

	function move(sectionId, direction) {
		const state = getState(),
			index = state.sections.findIndex((item) => item.id === sectionId),
			target = index + direction;
		if (index < 0 || target < 0 || target >= state.sections.length) return;
		const play = slideReorder([state.sections[index].id, state.sections[target].id], locate);
		[state.sections[index], state.sections[target]] = [state.sections[target], state.sections[index]];
		changed();
		renderAll();
		play();
	}

	function toggleOrder(sectionId) {
		const section = find(sectionId);
		if (!section) return;
		section.unordered = section.unordered !== true;
		changed();
		renderAll();
	}

	function collapseSectionBlocks(sectionId) {
		const section = find(sectionId);
		if (!section) return;
		const ui = ensureUiState(getState());
		(section.blocks || []).forEach((block) => {
			ui.collapsed.blocks[block.id] = true;
		});
		changed();
		renderAll();
	}

	function render({ openBlockId = null } = {}) {
		const root = document.getElementById("sections");
		root.replaceChildren();
		getState().sections.forEach((section) => {
			const element = document.createElement("div");
			element.className = "section";	   
			const collapsed = isCollapsed(getState(), "sections", section.id, true);
			const isChecked = section.enabled ? "checked" : "";
			const isExpandedStr = String(!collapsed);
			const bodyClass = collapsed ? "collapsed" : "";
			const title = escapeHtml(section.title);
			const description = escapeHtml(section.description || "");
			const actionsHtml = `
				<div class="actions">
					<button type="button" class="small" data-up>${t("up")}</button>
					<button type="button" class="small" data-down>${t("down")}</button>
					<div class="more-menu" data-more>
						<button type="button" class="small" data-more-toggle>${t("section.more")} ▾</button>
						<div class="more-items" hidden>
							<button type="button" data-add>${t("section.addBlock")}</button>
							<button type="button" data-add-section>${t("section.addSection")}</button>
							<button type="button" data-duplicate>${t("section.duplicate")}</button>
							<button type="button" data-collapse-block>${t("section.collapseBlocks")}</button>
							<button type="button" data-order>${section.unordered ? t("section.orderOrdered") : t("section.orderUnordered")}</button>
							<button type="button" class="danger" data-delete>${t("section.delete")}</button>
						</div>
					</div>
				</div>
			`;
			element.innerHTML = `
				<div class="section-head">
					<label><input type="checkbox" data-se="${section.id}" ${isChecked}></label>
					<button class="section-title-btn" 
						data-collapse-target="section-body-${section.id}" 
						data-collapse-scope="sections" 
						data-collapse-key="${section.id}" 
						aria-expanded="${isExpandedStr}">${title}</button>
					${actionsHtml}
				</div>
				<div class="section-body ${bodyClass}" id="section-body-${section.id}">
					<label class="field">${t("section.titleLabel")}<input data-title value="${title}"></label>
					<label class="field">${t("section.descLabel")}<textarea data-description>${description}</textarea></label>
					<div data-blocks></div>
					<div class="section-footer" style="margin-top: 1rem; display: flex; justify-content: flex-end;">
						${actionsHtml}
					</div>
				</div>
			`;
			root.appendChild(element);
			const blocks = element.querySelector("[data-blocks]");
			(section.blocks || []).forEach((block, index) => {
				block.level = normalizeBlockLevel(block.level, getMaxBlockLevel(section, index));
				const isOpen = block.id === openBlockId
					? true
					: !isCollapsed(getState(), "blocks", block.id, true);
				blocks.appendChild(blockRenderer.render(section.id, block, index, {
					open: isOpen,
					onToggle: (nextOpen) => {
						const ui = ensureUiState(getState());
						ui.collapsed.blocks[block.id] = !nextOpen;
						changed();
					},
				}));
			});
			element.querySelector("[data-se]").onchange = (event) => {
				section.enabled = event.target.checked;
				changed();
				renderAll();
			};
			element.querySelector("[data-title]").oninput = (event) => {
				section.title = event.target.value;
				changed();
				renderToggles();
				renderOutput();
			};
			element.querySelector("[data-description]").oninput = (event) => {
				section.description = event.target.value;
				changed();
			};
			element.querySelectorAll("[data-add]").forEach(btn => btn.onclick = () => addBlock(section.id));
			element.querySelectorAll("[data-up]").forEach(btn => btn.onclick = () => move(section.id, -1));
			element.querySelectorAll("[data-down]").forEach(btn => btn.onclick = () => move(section.id, 1));
			element.querySelectorAll("[data-duplicate]").forEach(btn => btn.onclick = () => duplicate(section.id));
			element.querySelectorAll("[data-add-section]").forEach(btn => btn.onclick = () => add());
			element.querySelectorAll("[data-delete]").forEach(btn => btn.onclick = () => remove(section.id));
			element.querySelectorAll("[data-order]").forEach(btn => btn.onclick = () => toggleOrder(section.id));
			element.querySelectorAll("[data-collapse-block]").forEach(btn => btn.onclick = () => collapseSectionBlocks(section.id));
		});
	}
	return {
		find,
		add,
		render
	};
}
