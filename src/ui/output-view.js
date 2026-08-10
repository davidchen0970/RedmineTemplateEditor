import { textile } from "../textile/generator.js";
import { textileToPreviewHtml } from "../textile/preview.js";

export function renderOutput(state, view) {
	const raw = textile(state);
	const output = document.getElementById("out");
	const preview = document.getElementById("preview");
	output.value = view === "json" ? JSON.stringify(state, null, 2) : raw;
	output.classList.toggle("hidden", view === "preview");
	preview.classList.toggle("hidden", view !== "preview");
	if (view === "preview") {
		preview.innerHTML = textileToPreviewHtml(raw);
		window.mermaid?.run({ querySelector: ".mermaid" }).catch((error) => console.warn("Mermaid render failed:", error));
	}
	document.querySelectorAll(".segmented button").forEach((button) => button.classList.remove("active"));
	const activeId = { raw: "raw", preview: "previewbtn", json: "statebtn" }[view];
	document.getElementById(activeId)?.classList.add("active");
	const stats = document.getElementById("stats");
	if (stats) stats.textContent = `${raw.length} 字元 · ${raw.split("\n").length} 行`;
}
