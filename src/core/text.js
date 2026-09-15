export const DEFAULT_CODE_LANG = "shell";

export const escapeHtml = (stringValue) =>
	String(stringValue ?? "").replace(
		/[&<>"]/g,
		(character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
	);

export const toNonEmptyTrimmedLines = (stringValue) =>
	String(stringValue || "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

export function safe(stringValue) {
	return String(stringValue || "redmine-note")
		.replace(/[\\/:*?"<>|\s]+/g, "_")
		.slice(0, 80);
}
