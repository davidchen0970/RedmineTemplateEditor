import {
	documentStateKey,
	createImplementationBlock,
	makeState,
	normalizeState,
	createSection
} from "../core/state.js";
import { t } from "../i18n.js";

export function splitPatch(text) {
	return String(text || "").split(/^diff --git /m).filter(Boolean)
		.map((part) => "diff --git " + part)
		.map((chunk) => {
			const match = chunk.match(/^diff --git\s+a\/(.+?)\s+b\/(.+?)\s*$/m);
			if (!match) return null;
			const path = match[2];
			return {
				name: path.split("/").pop(),
				folder: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".",
				content: chunk.trim()
			};
		})
		.filter((item) => item && item.content);
}

export function elide(name, max = 22) {
	if (name.length <= max) return name;
	const keep = Math.max(1, max - 3);
	const head = Math.ceil(keep * 0.6);
	const tail = keep - head;
	return name.slice(0, head) + "…" + name.slice(name.length - tail);
}

export function setupImportActions({
	getState,
	setState,
	getActiveId,
	changed,
	renderer
}) {
	document.getElementById("import").onclick = () => document.getElementById("file").click();
	document.getElementById("file").onchange = (event) => {
		const file = event.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const value = JSON.parse(reader.result);
				if (!value.environment || !Array.isArray(value.sections)) throw Error(t("import.invalid"));
				setState(normalizeState(value));
				changed();
				renderer.render();
				renderer.toast(t("import.toast.done"));
			} catch (error) {
				alert(t("import.alert.fail", { msg: error.message }));
			}
		};
		reader.readAsText(file);
		event.target.value = "";
	};

	const nextFrame = () => new Promise((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(resolve))
	);

	document.getElementById("patch").onclick = () => document.getElementById("patchFile").click();
	document.getElementById("patchFile").onchange = (event) => {
		const file = event.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = async () => {
			const files = splitPatch(reader.result);
			const total = files.length;
			if (!total) return alert(t("import.patch.none"));

			const state = getState();
			let section = state.sections.find((item) => item.title === "實作流程");
			if (!section) {
				section = createSection("實作流程", true);
				state.sections.push(section);
			}
			section.enabled = true;

			let converted = 0;
			for (const item of files) {
				const unit = createImplementationBlock(item.name, item.folder, "diff", item.content);
				section.blocks.push(unit);
				converted++;
				const percent = Math.round((converted / total) * 100);
				renderer.showPatchProgress(t("import.patch.progress", { converted, total, name: elide(item.name) }), percent);
				await nextFrame();
			}

			changed();
			renderer.render();
			renderer.showPatchProgress(t("import.patch.done", { total }), 100);
			renderer.hidePatchProgress();
			renderer.toast(t("import.toast.patchDone", { total }));
		};
		reader.readAsText(file);
		event.target.value = "";
	};

	document.getElementById("reset").onclick = () => {
		if (!confirm(t("import.resetConfirm"))) return;
		localStorage.removeItem(documentStateKey(getActiveId()));
		setState(makeState());
		changed();
		renderer.render();
	};
}
