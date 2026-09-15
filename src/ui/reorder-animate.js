export function reorderOffset(beforeTop, afterTop) {
	const a = Number(afterTop), b = Number(beforeTop);
	return Number.isFinite(a) && Number.isFinite(b) ? b - a : 0;
}

function cardTop(card) {
	return Number(card && card.getBoundingClientRect().top);
}

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
	window.setTimeout(done, 240);
}

export function slideReorder(ids, locate) {
	const before = ids.map((id) => ({ id, top: cardTop(locate(id)) }));
	const EASE = "transform 220ms cubic-bezier(0.2, 0.8, 0.25, 1)";
	return function play() {
		before.forEach(({ id, top }) => {
			const el = locate(id);
			if (!el) return;
			const offset = reorderOffset(top, cardTop(el));
			if (!offset) return;
			const start = "translateY(" + offset + "px)";
			el.style.transition = "none";
			el.style.transform = start;
			void el.getBoundingClientRect();
			el.style.transition = EASE;
			el.style.transform = "";
			const settle = () => {
				el.style.transform = "";
				el.style.transition = "";
			};
			el.addEventListener("transitionend", settle, { once: true });
			window.setTimeout(settle, 320);
		});
	};
}
