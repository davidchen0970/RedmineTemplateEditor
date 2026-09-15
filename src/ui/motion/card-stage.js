import { LEAVE_MS } from "./timing.js";

export function markEntering(id, locate) {
	const el = locate(id);
	if (el) el.classList.add("is-entering");
}

export function markLeaving(id, locate, done) {
	const el = locate(id);
	if (!el) {
		done();
		return;
	}
	el.classList.add("is-leaving");
	el.addEventListener("animationend", () => done(), { once: true });
	window.setTimeout(done, LEAVE_MS);
}
