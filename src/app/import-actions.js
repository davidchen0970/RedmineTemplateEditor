import {
	documentStateKey,
	createImplementationBlock,
	makeState,
	normalizeState,
	createSection
} from "../core/state.js";
import { markdownToState } from "../markdown/parser.js";

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
				if (!value.environment || !Array.isArray(value.sections)) throw Error("格式不符合");
				setState(normalizeState(value));
				changed();
				renderer.render();
				renderer.toast("JSON 資料已匯入");
			} catch (error) {
				alert("JSON 匯入失敗：" + error.message);
			}
		};
		reader.readAsText(file);
		event.target.value = "";
	};

	document.getElementById("importMd").onclick = () => document.getElementById("mdFile").click();
	document.getElementById("mdFile").onchange = (event) => {
		const file = event.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const value = normalizeState(markdownToState(reader.result));
				setState(value);
				changed();
				renderer.render();
				renderer.toast("Markdown 已匯入");
			} catch (error) {
				alert("Markdown 匯入失敗：" + error.message);
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
			if (!total) return alert("變更集匯入失敗：找不到差異區塊");

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
				renderer.showPatchProgress(`轉換檔案 ${converted}/${total}：${elide(item.name)}`, percent);
				await nextFrame();
			}

			changed();
			renderer.render();
			renderer.showPatchProgress(`已匯入 ${total} 個檔案！`, 100);
			renderer.hidePatchProgress();
			renderer.toast(`已匯入 ${total} 個程式碼單元`);
		};
		reader.readAsText(file);
		event.target.value = "";
	};

	document.getElementById("reset").onclick = () => {
		if (!confirm("清除目前文件並重設？")) return;
		localStorage.removeItem(documentStateKey(getActiveId()));
		setState(makeState());
		changed();
		renderer.render();
	};
}
