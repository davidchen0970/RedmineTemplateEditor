import { esc, sec, uid } from "../core/state.js";
import { isCollapsed, getMaxBlockLevel, normalizeBlockLevel } from "./ui-state.js";
export function createSectionRenderer({
    getState,
    changed,
    renderAll,
    renderToggles,
    renderOutput,
    blockRenderer,
    addBlock
}) {
    const find = (id) => getState().sections.find((section) => section.id === id);

    function add(title = "新增段落") {
        getState().sections.push(sec(prompt("段落標題 h3.", title) || title, true));
        changed();
        renderAll();
    }

    function duplicate(id) {
        const state = getState(),
            target = find(id);
        if (!target) return;
        const copy = JSON.parse(JSON.stringify(target));
        copy.id = uid();
        copy.title = (copy.title || "段落") + " copy";
        copy.blocks = (copy.blocks || []).map((item) => ({
            ...item,
            id: uid()
        }));
        const index = state.sections.findIndex((item) => item.id === id);
        state.sections.splice(index + 1, 0, copy);
        changed();
        renderAll();
    }

    function remove(id) {
        const state = getState(),
            section = find(id);
        if (section && confirm(`刪除段落「${section.title}」？`)) {
            state.sections = state.sections.filter((item) => item.id !== id);
            if (state.ui?.collapsed?.sections) delete state.ui.collapsed.sections[id];
            changed();
            renderAll();
        }
    }

    function move(id, direction) {
        const state = getState(),
            index = state.sections.findIndex((item) => item.id === id),
            target = index + direction;
        if (index < 0 || target < 0 || target >= state.sections.length) return;
        [state.sections[index], state.sections[target]] = [state.sections[target], state.sections[index]];
        changed();
        renderAll();
    }

    function render() {
        const root = document.getElementById("sections");
        root.replaceChildren();
        getState().sections.forEach((section) => {
            const element = document.createElement("div");
            element.className = "section";
            const collapsed = isCollapsed(getState(), "sections", section.id, true);
            element.innerHTML = `<div class="section-head"><label><input type="checkbox" data-se="${section.id}" ${section.enabled?"checked":""}></label><button class="section-title-btn" data-collapse-target="section-body-${section.id}" data-collapse-scope="sections" data-collapse-key="${section.id}" aria-expanded="${String(!collapsed)}">${esc(section.title)}</button><div class="actions"><button class="small" data-up>上移</button><button class="small" data-down>下移</button><button class="small" data-add>新增區塊</button><button class="small" data-duplicate>複製段落</button><button class="small danger" data-delete>刪除</button></div></div><div class="section-body ${collapsed?"collapsed":""}" id="section-body-${section.id}"><label class="field">段落標題 h3.<input data-title value="${esc(section.title)}"></label><label class="field">段落說明<textarea data-description>${esc(section.description||"")}</textarea></label><div data-blocks></div></div>`;
            root.appendChild(element);
            const blocks = element.querySelector("[data-blocks]");
            (section.blocks || []).forEach((block, index) => {
                block.level = normalizeBlockLevel(block.level, getMaxBlockLevel(section, index));
                blocks.appendChild(blockRenderer.render(section.id, block, index));
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
            element.querySelector("[data-add]").onclick = () => addBlock(section.id);
            element.querySelector("[data-up]").onclick = () => move(section.id, -1);
            element.querySelector("[data-down]").onclick = () => move(section.id, 1);
            element.querySelector("[data-duplicate]").onclick = () => duplicate(section.id);
            element.querySelector("[data-delete]").onclick = () => remove(section.id);
        });
    }
    return {
        find,
        add,
        render
    };
}
