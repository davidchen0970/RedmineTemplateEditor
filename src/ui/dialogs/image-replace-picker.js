import { registerPreviewImage } from "../../textile/preview.js";
import { readFileAsDataUrl } from "../io/read.js";
import { t } from "../../i18n.js";

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
			img.title = t("image.loadFailTitle");
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
		pendingName = file && file.type && file.type.startsWith("image/") ? pendingName : null;
		if (!pendingName) return;
		readFileAsDataUrl(file)
			.then((dataUrl) => {
				const name = pendingName;
				pendingName = null;
				registerPreviewImage(name, dataUrl);
				if (typeof renderPreview === "function") renderPreview();
			})
			.catch(() => {
				pendingName = null;
			});
	});

	return () => fileInput.remove();
}
