export function setupMobileHeaderCollapse() {
	const header = document.getElementById("siteHeader");
	const toggle = document.getElementById("headerMenuToggle");
	const actions = document.getElementById("headerActions");
	if (!header || !toggle || !actions) return;

	const mobileQuery = window.matchMedia("(max-width: 1199px)");
	const setExpanded = (expanded) => {
		header.classList.toggle("is-collapsed", !expanded);
		toggle.setAttribute("aria-expanded", String(expanded));
		toggle.setAttribute("aria-label", expanded ? "收合頁首選單" : "展開頁首選單");
	};
	const syncMode = () => setExpanded(!mobileQuery.matches);

	toggle.addEventListener("click", () => {
		setExpanded(toggle.getAttribute("aria-expanded") !== "true");
	});
	if (typeof mobileQuery.addEventListener === "function") {
		mobileQuery.addEventListener("change", syncMode);
	} else {
		mobileQuery.addListener(syncMode);
	}
	syncMode();
}

setupMobileHeaderCollapse();
