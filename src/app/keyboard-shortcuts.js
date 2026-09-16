import { textile } from "../textile/generator.js";
import { exportMermaidPng } from "../ui/output/mermaid-export.js";

// Single source of truth for every shortcut the app registers. The keydown handler
// and the 快捷鍵 help dialog both read from this list so they can never drift.
export const SHORTCUTS = [
	{ code: "KeyC", keys: "Ctrl/⌘ + Shift + C", action: "複製 Redmine Textile 到剪貼簿" },
	{ code: "KeyJ", keys: "Ctrl/⌘ + Shift + J", action: "複製整份 JSON" },
	{ code: "KeyS", keys: "Ctrl/⌘ + Shift + S", action: "匯出 Mermaid PNG 並複製 Textile" },
];

// Screenshot_YYYYMMDD_HHMMSS.png (local time); disambiguate repeats.
function screenshotPngName(index, names) {
	const d = new Date();
	const pad = (n) => String(n).padStart(2, "0");
	const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
		`_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
	let name = `Screenshot_${stamp}.png`;
	while (names.includes(name)) name = `Screenshot_${stamp}_${index + 1}.png`;
	return name;
}

// Replace every "{{mermaid ... }}" block in the generated textile with "!name!",
// one name per block in order. Leaves everything outside mermaid untouched.
export function replaceMermaidBlocks(textileText, fileNames) {
	const lines = String(textileText || "").split("\n");
	const names = [...fileNames];
	const out = [];
	let inMermaid = false;
	let pendingName = "";
	for (const line of lines) {
		const trimmed = line.trim();
		if (!inMermaid) {
			if (trimmed === "{{mermaid") {
				inMermaid = true;
				pendingName = names.shift() ?? "";
				continue;
			}
			out.push(line);
			continue;
		}
		if (trimmed === "}}" || trimmed.endsWith("}}")) {
			out.push(`!${pendingName}!`);
			inMermaid = false;
		}
	}
	if (inMermaid) out.push(`!${pendingName}!`);
	return out.join("\n");
}

export function setupKeyboardShortcuts({ getState, renderer, setExportStatus }) {
	document.addEventListener("keydown", async (event) => {
		if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
		const shortcut = SHORTCUTS.find((item) => item.code === event.code);
		if (!shortcut) return;
		event.preventDefault();
		try {
			if (event.code === "KeyC") {
				await navigator.clipboard.writeText(textile(getState()));
				renderer.toast("已複製 Textile");
			} else if (event.code === "KeyJ") {
				await navigator.clipboard.writeText(JSON.stringify(getState(), null, 2));
				setExportStatus("json");
				renderer.toast("已複製 JSON");
			} else {
				await exportMermaidAndCopy(getState());
				renderer.toast("已下載 mermaid PNG 並複製 Textile");
			}
		} catch (error) {
			console.error("快捷鍵失敗:", error);
		}
	});
}

async function exportMermaidAndCopy(state) {
	const hosts = [...document.querySelectorAll("#preview .mermaid")];
	const names = [];
	for (const host of hosts) {
		const svg = host.querySelector("svg");
		if (!svg) continue;
		const name = screenshotPngName(names.length, names);
		names.push(name);
		await exportMermaidPng(svg, name);
	}
	let text = textile(state);
	if (names.length) text = replaceMermaidBlocks(text, names);
	await navigator.clipboard.writeText(text);
}
