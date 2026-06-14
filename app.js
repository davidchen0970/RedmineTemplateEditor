(function () {
	const scripts = ["js/state.js", "js/textile.js", "js/renderer.js"];

	function loadScript(src) {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = src;
			script.defer = true;
			script.onload = resolve;
			script.onerror = () => reject(new Error("載入失敗: " + src));
			document.head.appendChild(script);
		});
	}

	function boot() {
		scripts
			.reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve())
			.then(() => {
				if (typeof window.initApp === "function") window.initApp();
			})
			.catch((err) => {
				console.error(err);
				alert(err.message || "JavaScript 載入失敗");
			});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", boot, { once: true });
	} else {
		boot();
	}
})();
