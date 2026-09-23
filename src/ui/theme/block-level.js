// Block-level display preference. Mirrors setupTheme(): a global UI pref kept in
// localStorage, defaulting to ON ("any value other than '0' means visible").
export function setupBlockLevelToggle(storageKey) {
	const checkbox = document.getElementById("blockLevelToggle");
	const subscribers = [];

	const read = () => localStorage.getItem(storageKey) !== "0";

	if (checkbox) {
		checkbox.checked = read();
		checkbox.addEventListener("change", () => {
			localStorage.setItem(storageKey, checkbox.checked ? "1" : "0");
			subscribers.forEach((fn) => fn(checkbox.checked));
		});
	}

	return {
		isVisible: () => (checkbox ? read() : true),
		onChange: (fn) => subscribers.push(fn),
	};
}
