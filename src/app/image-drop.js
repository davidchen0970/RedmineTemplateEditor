import { registerPreviewImage } from "../textile/preview.js";

export function setupImageDrop() {
	document.addEventListener("dragover", (event) => {
		if (imageFilesFromEvent(event).length) event.preventDefault();
	});

	document.addEventListener("drop", (event) => {
		const files = imageFilesFromEvent(event);
		if (!files.length) return;
		event.preventDefault();

		const target = event.target.closest("[data-cont-index]");
		if (!target) return;

		Promise.all(
			files.map(
				(file) =>
					new Promise((resolve, reject) => {
						const reader = new FileReader();
						reader.onload = () => resolve({ name: file.name, dataUrl: reader.result });
						reader.onerror = () => reject(reader.error);
						reader.readAsDataURL(file);
					}),
			),
		)
			.then((images) => {
			const firstImage = target.value != null ? target.value : "";
			const prefix = firstImage && firstImage.trim() ? "\n" : "";
			const markers = images.map(({ name, dataUrl }) => {
				registerPreviewImage(name, dataUrl);
				return "!" + name + "!";
			});
			if (!markers.length) return;
			target.value = firstImage + prefix + markers.join("\n");
			target.dispatchEvent(new Event("input", { bubbles: true }));
		})
			.catch(() => {});
	});
}

function imageFilesFromEvent(event) {
	const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
	return files.filter((file) => file && file.type && file.type.startsWith("image/"));
}
