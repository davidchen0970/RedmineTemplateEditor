export function triggerDownload(filename, text, type) {
	const anchor = document.createElement("a");
	const url = URL.createObjectURL(new Blob([text], { type }));
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}
