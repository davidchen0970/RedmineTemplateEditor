import { createEnvItem, normalizeEnvironment, presets, escapeHtml } from "../../core/state.js";

const ENV_HINTS = {
	"CPLD 版本": "(ipmitool raw 0x32 0x1a 0xf1 / i2cget -y 7 0x071 0xf1)",
};

function bindInput(elementId, value, setter, changed) {
	const element = document.getElementById(elementId);
	if (!element) return;
	if (document.activeElement !== element) element.value = value || "";
	element.oninput = () => { setter(element.value); changed(); };
	element.onchange = element.oninput;
}

export function createFormRenderer({ getState, changed, onPresetClick, findSection, renderAll }) {
	function renderPresets() {
		const root = document.getElementById("templates");
		if (!root) return;
		root.replaceChildren();
		Object.entries(presets).forEach(([key, preset]) => {
			const card = document.createElement("div");
			card.className = `card ${getState().noteType === key ? "active" : ""}`;
			card.innerHTML = `<strong>${escapeHtml(preset.label)}</strong><span>${escapeHtml(preset.desc)}</span>`;
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
		renderEnv();
	}

	let envShownIds = null;

	function leaveOut(node, done) {
		if (!node || !node.animate) { done(); return; }
		const anim = node.animate(
			[
				{ opacity: 1, transform: "none" },
				{ opacity: 0, transform: "translateY(6px) scale(0.94)" },
			],
			{ duration: 240, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
		);
		anim.onfinish = () => {
			node.classList.add("env-gone");
			done();
		};
	}

	function renderEnv() {
		const root = document.getElementById("env");
		if (!root) return;
		getState().environment = normalizeEnvironment(getState().environment);
		const items = getState().environment;
		root.replaceChildren();

		const palette = document.createElement("div");
		palette.className = "env-palette";
		items.filter((item) => !item.custom).forEach((item) => {
			const chip = document.createElement("button");
			chip.type = "button";
			chip.className = "env-chip" + (item.enabled ? " active" : "");
			chip.textContent = item.label;
			chip.onclick = () => {
				const target = getState().environment.find((i) => i.id === item.id);
				if (!target) return;
				target.enabled = !target.enabled;
				changed();
				if (target.enabled) {
					renderAll();
				} else {
					leaveOut(root.querySelector(`[data-env-id="${item.id}"]`), renderAll);
				}
			};
			palette.appendChild(chip);
		});
		const addBtn = document.createElement("button");
		addBtn.type = "button";
		addBtn.className = "env-add";
		addBtn.textContent = "＋ 自定義測試環境項目";
		addBtn.onclick = () => {
			getState().environment.push(createEnvItem("自訂項目", "", true, true));
			changed();
			renderAll();
		};
		palette.appendChild(addBtn);
		root.appendChild(palette);

		const grid = document.createElement("div");
		grid.className = "env-grid";

		const prevShown = envShownIds;
		const nowShown = new Set();
		items.filter((item) => item.enabled).forEach((item) => {
			const card = document.createElement("div");
			card.className = "section";
			card.dataset.envId = item.id;
			nowShown.add(item.id);
			if (prevShown !== null && !prevShown.has(item.id)) card.classList.add("env-in");

			const head = document.createElement("div");
			head.className = "section-head";

			const chkLabel = document.createElement("label");
			const box = document.createElement("input");
			box.type = "checkbox";
			box.checked = true;
			box.onchange = () => {
				const target = getState().environment.find((i) => i.id === item.id);
				if (!target) return;
				target.enabled = box.checked;
				changed();
				if (target.enabled) {
					renderAll();
				} else {
					leaveOut(root.querySelector(`[data-env-id="${item.id}"]`), renderAll);
				}
			};
			chkLabel.appendChild(box);

			const title = document.createElement(item.custom ? "input" : "button");
			title.className = "section-title-btn";
			if (item.custom) {
				title.type = "text";
				title.value = item.label;
				title.placeholder = "自訂項目名稱";
				title.oninput = () => {
					const target = getState().environment.find((i) => i.id === item.id);
					if (target) { target.label = title.value; changed(); }
				};
			} else {
				title.type = "button";
				title.textContent = item.label;
			}

			const actions = document.createElement("div");
			actions.className = "actions";
			let hintEl = null;
			const hint = ENV_HINTS[item.label];
			if (hint) {
				const toggle = document.createElement("button");
				toggle.type = "button";
				toggle.className = "small";
				toggle.textContent = "指令";
				toggle.onclick = () => {
					if (hintEl) hintEl.hidden = !hintEl.hidden;
				};
				actions.appendChild(toggle);
			}
			const del = document.createElement("button");
			del.type = "button";
			del.className = "small danger";
			del.textContent = "✕";
			del.title = "移除項目";
			del.onclick = () => {
				const target = getState().environment.find((i) => i.id === item.id);
				if (!target) return;
				const node = root.querySelector(`[data-env-id="${item.id}"]`);
				if (target.custom) {
					getState().environment = getState().environment.filter((i) => i.id !== item.id);
				} else {
					target.enabled = false;
				}
				changed();
				leaveOut(node, renderAll);
			};
			actions.appendChild(del);

			head.appendChild(chkLabel);
			head.appendChild(title);
			head.appendChild(actions);

			const body = document.createElement("div");
			body.className = "section-body";
			if (hint) {
				hintEl = document.createElement("div");
				hintEl.className = "env-hint";
				hintEl.hidden = true;
				const code = document.createElement("code");
				code.textContent = hint;
				const copy = document.createElement("button");
				copy.type = "button";
				copy.className = "small";
				copy.textContent = "複製";
				copy.onclick = () => navigator.clipboard.writeText(hint);
				hintEl.appendChild(code);
				hintEl.appendChild(copy);
				body.appendChild(hintEl);
			}
			const fld = document.createElement("label");
			fld.className = "field";
			const area = document.createElement("textarea");
			area.value = item.value;
			area.oninput = () => {
				const target = getState().environment.find((i) => i.id === item.id);
				if (target) { target.value = area.value; changed(); }
			};
			fld.appendChild(area);
			body.appendChild(fld);

			card.appendChild(head);
			card.appendChild(body);
			grid.appendChild(card);
		});
		envShownIds = nowShown;
		root.appendChild(grid);
	}

	function renderToggles() {
		const root = document.getElementById("toggles");
		if (!root) return;
		root.replaceChildren();
		getState().sections.forEach((section) => {
			const item = document.createElement("label");
			const isChecked = section.enabled ? "checked" : "";
			const sectionTitle = escapeHtml(section.title);
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
