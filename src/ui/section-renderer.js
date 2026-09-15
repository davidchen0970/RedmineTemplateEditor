import { escapeHtml, createSection, createId } from "../core/state.js";
import { isCollapsed, getMaxBlockLevel, normalizeBlockLevel } from "./ui-state.js";
import { slideReorder, markEntering, markLeaving } from "./reorder-animate.js";
import { sectionCard } from "./card-dom.js";
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

	function add(title = "新增段落") {
		const section = createSection(prompt("段落標題 h3.", title) || title, true);
		getState().sections.push(section);
		changed();
		renderAll();
		markEntering(section.id, locate);
	}

	function duplicate(sectionId) {
		const state = getState(),
			target = find(sectionId);
		if (!target) return;
		const copy = JSON.parse(JSON.stringify(target));
		copy.id = createId();
		copy.title = (copy.title || "段落") + " copy";
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

	function remove(sectionId) {
		const state = getState(),
			section = find(sectionId);
		if (!section || !confirm(`刪除段落「${section.title}」？`)) return;
		markLeaving(sectionId, locate, () => {
			state.sections = state.sections.filter((item) => item.id !== sectionId);
			if (state.ui?.collapsed?.sections) delete state.ui.collapsed.sections[sectionId];
			changed();
			renderAll();
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
					<button type="button" class="small" data-up>上移</button>
					<button type="button" class="small" data-down>下移</button>
					<div class="more-menu" data-more>
						<button type="button" class="small" data-more-toggle>其他 ▾</button>
						<div class="more-items" hidden>
							<button type="button" data-add>新增區塊</button>
							<button type="button" data-add-section>新增段落</button>
							<button type="button" data-duplicate>複製段落</button>
							<button type="button" class="danger" data-delete>刪除段落</button>
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
					<label class="field">段落標題 h3.<input data-title value="${title}"></label>
					<label class="field">段落說明<textarea data-description>${description}</textarea></label>
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
				blocks.appendChild(blockRenderer.render(section.id, block, index, {
					open: block.id === openBlockId
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
		});
	}
	return {
		find,
		add,
		render
	};
}
