import { presets, presetsEn } from "../../core/state.js";
import { dismissOnBackdrop } from "./dismiss-on-backdrop.js";
import { applyStaticText, getLocale, t } from "../../i18n.js";

// Localizable test-environment boilerplate: the dialog lets you add/remove these
// pre-filled section names. en is swapped in when the app runs in English.
const EXTRA_SECTIONS = {
	zh: ["測試環境", "參考資料", "附圖", "結論補充"],
	en: ["Test environment", "Reference", "Screenshot", "Conclusion supplement"],
};
const extraSections = () => EXTRA_SECTIONS[getLocale() === "en" ? "en" : "zh"];
// Localizable preset content (labels/descs/section rows). zh stays as model presets.
const inEn = () => getLocale() === "en";
const presetEn = (preset, key) => (inEn() && presetsEn[key] ? presetsEn[key] : preset);
const sectionsOf = (type) => presetEn(presets[type], type).sections || [];

let dialog = null;
let pendingResolve = null;
let onLocaleChange = null;

function ensureDialog() {
	if (dialog) return dialog;
	dialog = document.createElement("dialog");
	dialog.id = "ndDialog";
	dialog.className = "add-block-dialog";
	dialog.innerHTML = `
		<div class="dialog-head" data-i18n="storage.new"></div>
		<div class="dialog-body">
			<label class="field"><span data-i18n="ndd.name"></span><input id="ndName" type="text"></label>
			<div class="section-label" data-i18n="ndd.template"></div>
			<div class="template-list" id="ndTemplates"></div>
			<div class="section-label" data-i18n="ndd.sections"></div>
			<div class="toggle-list" id="ndSections"></div>
			<div class="actions">
				<input id="ndSectionInput" type="text" data-i18n-ph="ndd.addSectionPlaceholder">
				<button type="button" id="ndSectionAdd" data-i18n="ndd.addSection">＋新增段落</button>
			</div>
		</div>
		<div class="dialog-actions">
			<button type="button" id="ndCancel" data-i18n="cancel"></button>
			<button type="button" id="ndConfirm" class="primary" data-i18n="ndd.create">建立</button>
		</div>`;
	dialog.addEventListener("close", () => finish(null));
	// Clicking the backdrop closes the dialog (cancels, finish(null)).
	dismissOnBackdrop(dialog);
	document.body.appendChild(dialog);
	applyStaticText(dialog);
	return dialog;
}

function finish(value) {
	if (!pendingResolve) return;
	const resolve = pendingResolve;
	pendingResolve = null;
	resolve(value);
}

function closeAnimated() {
	if (!dialog) return;
	dialog.classList.add("closing");
	const onEnd = (event) => {
		if (event.target !== dialog) return;
		dialog.removeEventListener("animationend", onEnd);
		dialog.classList.remove("closing");
		dialog.close();
	};
	dialog.addEventListener("animationend", onEnd);
}

export function openNewDocDialog(defaultName = t("ndd.defaultName")) {
	const root = ensureDialog();
	const nameInput = root.querySelector("#ndName");
	const templatesRoot = root.querySelector("#ndTemplates");
	const sectionsRoot = root.querySelector("#ndSections");
	const sectionInput = root.querySelector("#ndSectionInput");
	const sectionAdd = root.querySelector("#ndSectionAdd");
	const cancelBtn = root.querySelector("#ndCancel");
	const confirmBtn = root.querySelector("#ndConfirm");

	let noteType = "porting";
	let sectionRows = [];

	applyStaticText(root);
	if (onLocaleChange) document.removeEventListener("i18n:change", onLocaleChange);
	onLocaleChange = () => {
		if (!dialog || !dialog.open) return;
		applyStaticText(dialog);
		renderTemplateCards();
		renderSectionRows();
	};
	document.addEventListener("i18n:change", onLocaleChange);

	const baseSections = () => [
		...(sectionsOf(noteType) || []).map((section) => ({ title: section.title, enabled: true })),
		...extraSections().map((title) => ({ title, enabled: false })),
	];

	const renderTemplateCards = () => {
		templatesRoot.replaceChildren();
		for (const [key, preset] of Object.entries(presets)) {
			const card = document.createElement("div");
			const localized = inEn() && presetsEn[key] ? presetsEn[key] : {};
			const label = localized.label || preset.label;
			const desc = localized.desc ?? preset.desc;
			card.className = "card" + (key === noteType ? " active" : "");
			card.innerHTML = `<strong>${label}</strong><span>${desc}</span>`;
			card.onclick = () => {
				noteType = key;
				sectionRows = baseSections();
				renderTemplateCards();
				renderSectionRows();
			};
			templatesRoot.appendChild(card);
		}
	};

	const renderSectionRows = () => {
		sectionsRoot.replaceChildren();
		sectionRows.forEach((row, index) => {
			const rowElement = document.createElement("label");
			rowElement.className = "note" + (row.enabled ? "" : " nd-unused");
			const box = document.createElement("input");
			box.type = "checkbox";
			box.checked = row.enabled;
			box.onchange = () => {
				row.enabled = box.checked;
				rowElement.classList.toggle("nd-unused", !box.checked);
			};
			const title = document.createElement("span");
			title.textContent = row.title;
			const remove = document.createElement("button");
			remove.type = "button";
			remove.textContent = t("ndd.remove");
			remove.onclick = () => {
				sectionRows.splice(index, 1);
				renderSectionRows();
			};
			rowElement.appendChild(box);
			rowElement.appendChild(title);
			rowElement.appendChild(remove);
			sectionsRoot.appendChild(rowElement);
		});
	};

	const addSection = () => {
		const title = sectionInput.value.trim();
		if (!title) return;
		sectionRows.push({ title, enabled: true });
		sectionInput.value = "";
		sectionInput.focus();
		renderSectionRows();
	};

	cancelBtn.onclick = () => {
		closeAnimated();
	};

	confirmBtn.onclick = () => {
		const name = nameInput.value.trim() || defaultName;
		const sections = sectionRows.filter((row) => row.enabled).map((row) => ({ title: row.title, enabled: true }));
		finish({ name, noteType, sections });
		closeAnimated();
	};

	nameInput.value = defaultName;
	nameInput.onkeydown = (event) => {
		if (event.key === "Enter") { event.preventDefault(); confirmBtn.click(); }
	};
	sectionAdd.onclick = addSection;
	sectionInput.onkeydown = (event) => {
		if (event.key === "Enter") { event.preventDefault(); addSection(); }
	};

	sectionRows = (sectionsOf(noteType) || []).map((section) => ({
		title: section.title,
		enabled: true,
	}));
	renderTemplateCards();
	renderSectionRows();

	root.showModal();
	nameInput.select();
	return new Promise((resolve) => {
		pendingResolve = resolve;
	});
}
