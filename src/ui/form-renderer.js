import { envKeys, presets, esc } from "../core/state.js";

function bindInput(id, value, setter, changed) {
	const element = document.getElementById(id);
	if (!element) return;
	if (document.activeElement !== element) element.value = value || "";
	element.oninput = () => { setter(element.value); changed(); };
	element.onchange = element.oninput;
}

export function createFormRenderer({ getState, changed, onPresetClick, findSection, renderAll }) {
	function renderPresets() {
		const root = document.getElementById("templates");
		root.replaceChildren();
		Object.entries(presets).forEach(([key, preset]) => {
			const card = document.createElement("div");
			card.className = `card ${getState().noteType === key ? "active" : ""}`;
			card.innerHTML = `<strong>${esc(preset.label)}</strong><span>${esc(preset.desc)}</span>`;
			card.onclick = () => onPresetClick(key);
			root.appendChild(card);
		});
	}

	function renderFields() {
		const state = getState();
		bindInput("title", state.title, (value) => state.title = value, changed);
		bindInput("status", state.status, (value) => state.status = value, changed);
		bindInput("summary", state.summary, (value) => state.summary = value, changed);
		bindInput("change", state.changeContent, (value) => state.changeContent = value, changed);
		bindInput("ref", state.relatedRef, (value) => state.relatedRef = value, changed);
		const root = document.getElementById("env");
		root.replaceChildren();
		envKeys.forEach(([key, label]) => {
			const field = document.createElement("label");
			field.className = "field";
			const hint = key === "cpldVersion" ? "<br><label> (ipmitool raw 0x32 0x1a 0xf1 / i2cget -y 7 0x071 0xf1)</label>" : "";
			field.innerHTML = `<label>${esc(label)}</label>${hint}<textarea data-env="${key}">${esc(state.environment[key] || "")}</textarea>`;
			root.appendChild(field);
		});
		root.querySelectorAll("[data-env]").forEach((element) => {
			element.oninput = () => { state.environment[element.dataset.env] = element.value; changed(); };
		});
	}

	function renderToggles() {
		const root = document.getElementById("toggles");
		root.replaceChildren();
		getState().sections.forEach((section) => {
			const item = document.createElement("label");
			const isChecked = section.enabled ? "checked" : "";
			const sectionTitle = esc(section.title);
			item.className = "note";
			item.innerHTML = `
				<input type="checkbox" data-section-toggle="${section.id}" ${isChecked}> 
				${sectionTitle}
			`;
			root.appendChild(item);
		});
		root.querySelectorAll("[data-section-toggle]").forEach((element) => {
			element.onchange = () => { findSection(element.dataset.sectionToggle).enabled = element.checked; changed(); renderAll(); };
		});
	}
	return { renderPresets, renderFields, renderToggles };
}
