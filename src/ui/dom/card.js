export function blockCard(id) {
	return document.querySelector('.block[data-block="' + id + '"]');
}

export function sectionCard(id) {
	return document.getElementById("section-body-" + id)?.closest(".section") || null;
}
