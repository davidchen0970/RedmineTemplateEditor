export function setupWorkspaceResize(storageKey) {
    const workspace = document.getElementById("workspace");
    const resizer = document.getElementById("workspaceResizer");
    if (!workspace || !resizer) return;

    const desktopQuery = window.matchMedia("(min-width: 901px)");
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const applySideWidth = (sideWidth) => {
        if (!desktopQuery.matches) {
            workspace.style.removeProperty("--output-col");
            workspace.style.removeProperty("--side-col");
            return;
        }
        const available = workspace.getBoundingClientRect().width - (resizer.getBoundingClientRect().width || 10) - 16;
        const next = clamp(sideWidth, 340, Math.max(340, available - 560));
        workspace.style.setProperty("--output-col", "minmax(560px, 1fr)");
        workspace.style.setProperty("--side-col", next + "px");
        localStorage.setItem(storageKey, String(next));
    };
    const restore = () => applySideWidth(Number(localStorage.getItem(storageKey)) || 420);
    let dragging = false;
    const onMove = (event) => {
        if (dragging && desktopQuery.matches) {
            applySideWidth(event.clientX - workspace.getBoundingClientRect().left - 8);
        }
    };
    const stop = () => {
        if (!dragging) return;
        dragging = false;
        resizer.classList.remove("is-dragging");
        document.body.classList.remove("is-resizing");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
    };
    resizer.addEventListener("pointerdown", (event) => {
        if (!desktopQuery.matches) return;
        dragging = true;
        resizer.classList.add("is-dragging");
        document.body.classList.add("is-resizing");
        resizer.setPointerCapture?.(event.pointerId);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", stop);
        window.addEventListener("pointercancel", stop);
        event.preventDefault();
    });
    resizer.addEventListener("keydown", (event) => {
        if (!desktopQuery.matches) return;
        const current = Number(localStorage.getItem(storageKey)) || 420;
        const step = event.shiftKey ? 40 : 20;
        const widths = {
            ArrowLeft: current + step,
            ArrowRight: current - step,
            Home: 340,
            End: 720
        };
        if (event.key in widths) {
            applySideWidth(widths[event.key]);
            event.preventDefault();
        }
    });
    if (typeof desktopQuery.addEventListener === "function") {
        desktopQuery.addEventListener("change", restore);
    } else {
        desktopQuery.addListener(restore);
    }
    window.addEventListener("resize", restore);
    restore();
}