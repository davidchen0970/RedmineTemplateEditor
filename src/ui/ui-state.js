export function ensureUiState(state) {
	state.ui ||= {};
	state.ui.collapsed ||= {};
	state.ui.collapsed.sections ||= {};
	state.ui.collapsed.blocks ||= {};
	return state.ui;
}

export function isCollapsed(state, scope, sectionId, defaultValue = false) {
	return ensureUiState(state).collapsed[scope]?.[sectionId] ?? defaultValue;
}

export function normalizeBlockLevel(value, maxLevel = Infinity) {
	const raw = Number(value);
	const level = Number.isFinite(raw) ? Math.floor(raw) : 1;
	return Math.max(1, Math.min(level, maxLevel));
}

export function getMaxBlockLevel(section, index) {
	if (index <= 0) return 1;
	return normalizeBlockLevel(section.blocks[index - 1]?.level) + 1;
}
