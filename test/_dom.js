// jsdom DOM harness for the browser-only UI modules.
//
// `npm test` (= `node --test`) runs each test FILE in its own node process with
// no DOM. These helpers boot a jsdom window, install the browser globals the
// modules touch (`document`, `navigator`, `localStorage`, `CustomEvent`, ...),
// and polyfill the pieces jsdom still can't do:
//   - <dialog>.showModal() / .close()
//   - window.matchMedia() / prefers-color-scheme
//
// Call makeDom() ONCE at the top of a test file, before the dynamic `import`
// that pulls in the source module (the module reads globals at import time).
import { JSDOM } from "jsdom";

export function makeDom(bodyHtml = "") {
	// jsdom exposes no localStorage unless we hand it an origin URL.
	const dom = new JSDOM(`<!DOCTYPE html><html lang="en"><head></head><body>${bodyHtml}</body></html>`, {
		url: "https://example.test/",
	});
	const w = dom.window;

	// Surface the window's browser concepts onto process globals so the source
	// modules (which reference bare `document` / `navigator` / ...) work.
	// Some Node globals (e.g. `navigator`) are read-only getters; ignore the
	// ones we cannot override — Node's own en-US navigator yields the same locale.
	for (const name of [
		"window", "document", "navigator", "location", "localStorage",
		"Event", "CustomEvent", "HTMLElement", "HTMLDialogElement",
	]) {
		try {
			Object.defineProperty(globalThis, name, {
				configurable: true,
				writable: true,
				value: name in w ? w[name] : globalThis[name],
			});
		} catch {
			/* keep the host Node global as-is */
		}
	}

	// jsdom does not implement dialog.showModal/close. Polyfill on the prototype
	// (all <dialog> elements share it) and count invocations for assertions.
	const counts = { showed: 0, closed: 0 };
	Object.defineProperty(w.HTMLDialogElement.prototype, "showModal", {
		configurable: true,
		value() {
			counts.showed += 1;
			this.setAttribute("open", "");
		},
	});
	Object.defineProperty(w.HTMLDialogElement.prototype, "close", {
		configurable: true,
		value() {
			counts.closed += 1;
			this.removeAttribute("open");
		},
	});

	// jsdom has no matchMedia; theme reading needs it to report a theme.
	Object.defineProperty(w, "matchMedia", {
		configurable: true,
		value() {
			return {
				matches: false,
				addEventListener() {},
				removeEventListener() {},
				addListener() {},
				removeListener() {},
			};
		},
	});
	globalThis.matchMedia = w.matchMedia;

	return { w, dom, counts, body: w.document.body };
}
