export function toast(message) {
	const element = document.getElementById("toast");
	if (!element) return;
	element.textContent = message;
	element.classList.add("show");
	setTimeout(() => element.classList.remove("show"), 1800);
}
