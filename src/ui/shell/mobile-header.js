import { t } from "../../i18n.js";

export function setupMobileHeaderCollapse() {
	setupHeaderActionGroups();
}

function setupHeaderActionGroups() {
	const actions = document.getElementById("headerActions");
	if (!actions || actions.dataset.headerActionGroupsReady === "true") return;

	const storageActions = actions.querySelector(".storage-actions");
	if (!storageActions) return;

	const originalChildren = Array.from(actions.children);
	const extraNodes = originalChildren.filter((node) => node !== storageActions);

	const byId = new Map();
	extraNodes.forEach((node) => {
		if (node.id) byId.set(node.id, node);
	});

	const groups = [];

	// Notes keeps the localStorage document toolbar whole (like a File menu).
	const storageGroup = createActionGroup({
		name: "notes",
		labelKey: "header.group.notes",
		panelId: "headerNotesActionsPanel",
	});
	storageGroup.panel.appendChild(storageActions);
	actions.appendChild(storageGroup.root);
	groups.push(storageGroup);

	// The two hidden <input type=file> are not listed in any group, so they stay
	// invisible. The copy action lives in a "File" menu group. The true settings
	// (language / theme / shortcuts) move into a separate 設定 dialog, so "更多"
	// holds the remaining overflow actions (incl. download .textile) plus its 設定
	// opener.
	const groupSpecs = [
		{
			name: "file",
			labelKey: "header.group.file",
			ids: ["copy", "copySections", "txt", "json", "import", "patch"],
		},
		{
			name: "more",
			labelKey: "header.group.settings",
			ids: ["source_code", "reset"],
		},
	];

	groupSpecs.forEach((spec) => {
		const group = createActionGroup({
			name: spec.name,
			labelKey: spec.labelKey,
			panelId: `header${cap(spec.name)}ActionsPanel`,
		});
		spec.ids.forEach((id) => {
			const node = byId.get(id);
			if (node) group.panel.appendChild(node);
		});
		if (spec.name === "more") {
			const open = document.createElement("button");
			open.id = "settingsOpen";
			open.type = "button";
			open.textContent = t("settings.open");
			group.panel.prepend(open);
		}
		actions.appendChild(group.root);
		groups.push(group);
	});

	// Pin Notes to the left, ahead of the flat copy/download buttons.
	actions.insertBefore(storageGroup.root, actions.firstChild);

	groups.forEach((group) => {
		group.toggle.addEventListener("click", () => {
			const isAlreadyOpen = group.root.classList.contains("is-open");
			openGroups(groups, isAlreadyOpen ? null : group);
		});
	});

	actions.addEventListener("click", (event) => {
		const command = event.target.closest(".header-action-group-panel button");
		if (command) openGroups(groups, null);
	});

	document.addEventListener("pointerdown", (event) => {
		if (!actions.contains(event.target)) openGroups(groups, null);
	});

	document.addEventListener("keydown", (event) => {
		if (event.key !== "Escape") return;
		const openGroup = groups.find((group) => group.root.classList.contains("is-open"));
		if (!openGroup) return;
		openGroups(groups, null);
		openGroup.toggle.focus();
	});

	// Keep all groups collapsed until the user explicitly opens one.
	openGroups(groups, null);
	actions.dataset.headerActionGroupsReady = "true";

	// Re-label the toggles whenever the language changes.
	document.addEventListener("i18n:change", () => {
		groups.forEach((group) => {
			group.toggle.textContent = t(group.labelKey);
		});
	});
}

function openGroups(groups, targetGroup) {
	groups.forEach((group) => {
		const isOpen = group === targetGroup;
		group.root.classList.toggle("is-open", isOpen);
		group.toggle.setAttribute("aria-expanded", String(isOpen));
	});
}

function cap(value) {
	return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function createActionGroup({ name, labelKey, panelId }) {
	const root = document.createElement("section");
	root.className = "header-action-group";
	root.dataset.headerActionGroup = name;

	const toggle = document.createElement("button");
	toggle.type = "button";
	toggle.className = "header-action-group-toggle";
	toggle.setAttribute("aria-expanded", "false");
	toggle.setAttribute("aria-controls", panelId);
	toggle.textContent = t(labelKey);

	const panel = document.createElement("div");
	panel.id = panelId;
	panel.className = "header-action-group-panel";

	root.appendChild(toggle);
	root.appendChild(panel);

	return { root, toggle, panel, labelKey };
}

setupMobileHeaderCollapse();
