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

	const storageGroup = createActionGroup({
		name: "storage",
		label: "文件管理",
		panelId: "headerStorageActionsPanel",
	});

	const extraGroup = createActionGroup({
		name: "extra",
		label: "操作功能",
		panelId: "headerExtraActionsPanel",
	});

	storageGroup.panel.appendChild(storageActions);
	extraNodes.forEach((node) => extraGroup.panel.appendChild(node));

	actions.appendChild(storageGroup.root);
	actions.appendChild(extraGroup.root);

	const groups = [storageGroup, extraGroup];

	const setOpenGroup = (targetGroup) => {
		groups.forEach((group) => {
			const isOpen = group === targetGroup;
			group.root.classList.toggle("is-open", isOpen);
			group.toggle.setAttribute("aria-expanded", String(isOpen));
		});
	};

	groups.forEach((group) => {
		group.toggle.addEventListener("click", () => {
			const isAlreadyOpen = group.root.classList.contains("is-open");
			setOpenGroup(isAlreadyOpen ? null : group);
		});
	});

	document.addEventListener("pointerdown", (event) => {
		if (!actions.contains(event.target)) setOpenGroup(null);
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") setOpenGroup(null);
	});

	// Keep both groups collapsed until the user explicitly opens one.
	setOpenGroup(null);
	actions.dataset.headerActionGroupsReady = "true";
}

function createActionGroup({ name, label, panelId }) {
	const root = document.createElement("section");
	root.className = "header-action-group";
	root.dataset.headerActionGroup = name;

	const toggle = document.createElement("button");
	toggle.type = "button";
	toggle.className = "header-action-group-toggle";
	toggle.setAttribute("aria-expanded", "false");
	toggle.setAttribute("aria-controls", panelId);
	toggle.textContent = label;

	const panel = document.createElement("div");
	panel.id = panelId;
	panel.className = "header-action-group-panel";

	root.appendChild(toggle);
	root.appendChild(panel);

	return { root, toggle, panel };
}

setupMobileHeaderCollapse();
