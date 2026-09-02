export function toast(message) {
	const element = document.getElementById("toast");
	if (!element) return;
	element.textContent = message;
	element.classList.add("show");
	setTimeout(() => element.classList.remove("show"), 1800);
}

export function showPatchProgress(message, percent) {
	const element = document.getElementById("patchProgress");
	if (!element) return;
	const label = element.querySelector(".progress-label");
	const bar = element.querySelector(".progress-bar");
	if (label) label.textContent = message;
	if (bar) bar.style.width = `${percent || 0}%`;
	element.classList.add("show");
}

export function hidePatchProgress() {
	const element = document.getElementById("patchProgress");
	if (!element) return;
	element.classList.remove("show");
	setTimeout(() => {
		const bar = element.querySelector(".progress-bar");
		if (bar) bar.style.width = "0%";
	}, 250);
}
