import { presets } from "../../core/state.js";

const EXTRA_SECTIONS = ["測試環境", "參考資料", "附圖", "結論補充"];

let dialog = null;
let pendingResolve = null;

function ensureDialog() {
	if (dialog) return dialog;
	dialog = document.createElement("dialog");
	dialog.id = "ndDialog";
	dialog.className = "add-block-dialog";
	dialog.innerHTML = `
		<div class="dialog-head">新增文件</div>
		<div class="dialog-body">
			<label class="field">文件名稱<input id="ndName" type="text"></label>
			<div class="section-label">模板</div>
			<div class="template-list" id="ndTemplates"></div>
			<div class="section-label">段落（勾選要帶的，可增減）</div>
			<div class="toggle-list" id="ndSections"></div>
			<div class="actions">
				<input id="ndSectionInput" type="text" placeholder="新增段落名稱">
				<button type="button" id="ndSectionAdd">＋新增段落</button>
			</div>
		</div>
		<div class="dialog-actions">
			<button type="button" id="ndCancel">取消</button>
			<button type="button" id="ndConfirm" class="primary">建立</button>
		</div>`;
	dialog.addEventListener("close", () => finish(null));
	document.body.appendChild(dialog);
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

export function openNewDocDialog(defaultName = "新文件") {
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

	const baseSections = () => [
		...(presets[noteType].sections || []).map((section) => ({ title: section.title, enabled: true })),
		...EXTRA_SECTIONS.map((title) => ({ title, enabled: false })),
	];

	const renderTemplateCards = () => {
		templatesRoot.replaceChildren();
		for (const [key, preset] of Object.entries(presets)) {
			const card = document.createElement("div");
			card.className = "card" + (key === noteType ? " active" : "");
			card.innerHTML = `<strong>${preset.label}</strong><span>${preset.desc}</span>`;
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
			remove.textContent = "移除";
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

	sectionRows = (presets[noteType].sections || []).map((section) => ({
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
