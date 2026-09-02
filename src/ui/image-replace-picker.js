import { registerPreviewImage } from "../textile/preview.js";

export function setupImageReplacePicker(renderPreview) {
	const preview = document.getElementById("preview");
	if (!preview) return;

	const fileInput = document.createElement("input");
	fileInput.type = "file";
	fileInput.accept = "image/*";
	fileInput.hidden = true;
	document.body.appendChild(fileInput);

	let pendingName = null;

	preview.addEventListener(
		"error",
		(event) => {
			if (!(event.target instanceof HTMLImageElement)) return;
			const img = event.target;
			if (!img.dataset.previewName) return;
			img.classList.add("preview-image-pick");
			img.title = "圖片載入失敗，點一下可重新選擇圖片";
		},
		true,
	);

	preview.addEventListener("click", (event) => {
		const img = event.target.closest
			? event.target.closest("img.preview-image.preview-image-pick")
			: null;
		if (!img) return;
		pendingName = img.dataset.previewName;
		fileInput.value = "";
		fileInput.click();
	});

	fileInput.addEventListener("change", () => {
		const file = fileInput.files[0];
		pendingName =
			file && file.type && file.type.startsWith("image/") ? pendingName : null;
		if (!pendingName) return;
		const reader = new FileReader();
		reader.onload = () => {
			const name = pendingName;
			pendingName = null;
			registerPreviewImage(name, reader.result);
			if (typeof renderPreview === "function") renderPreview();
		};
		reader.onerror = () => {
			pendingName = null;
		};
		reader.readAsDataURL(file);
	});

	return () => fileInput.remove();
}
