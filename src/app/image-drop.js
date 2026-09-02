// 把拖進內容框的圖片：暫存 dataURL 供 preview 顯示，並把 !檔名! 插到該 content 框
import { registerPreviewImage } from "../textile/preview.js";

export function setupImageDrop() {
	document.addEventListener("dragover", (event) => {
		if (imageFileFromEvent(event)) event.preventDefault();
	});

	document.addEventListener("drop", (event) => {
		const file = imageFileFromEvent(event);
		if (!file) return;
		event.preventDefault();

		const target = event.target.closest("[data-cont-index]");
		if (!target) return;

		const reader = new FileReader();
		reader.onload = () => {
			const name = file.name;
			registerPreviewImage(name, reader.result);
			// 附加 !檔名!（Redmine 內嵌圖語法）
			target.value = (target.value != null ? target.value : "") + "!" + name + "!";
			// 觸發原 input 綁定，把值寫回 state、進而更新 preview
			target.dispatchEvent(new Event("input", { bubbles: true }));
		};
		reader.onerror = () => {};
		reader.readAsDataURL(file);
	});
}

function imageFileFromEvent(event) {
	const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
	const image = files.find((file) => file && file.type && file.type.startsWith("image/"));
	if (image) {
		event.preventDefault();
		return image;
	}
	return null;
}
