const scrollStack = [];
const IDLE_MS = 300;
let idleTimer = null;

export function onPreviewReRender(preview) {
	if (!preview) return;
	if (scrollStack.length === 0) {
		scrollStack.push(preview.scrollTop);
	}
	if (idleTimer) clearTimeout(idleTimer);
	preview.scrollTop = scrollStack[0];
	idleTimer = setTimeout(() => releaseScroll(preview), IDLE_MS);
}

function releaseScroll(preview) {
	if (!preview) return;
	if (scrollStack.length) preview.scrollTop = scrollStack[0];
	scrollStack.length = 0;
}
