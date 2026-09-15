export function setupTheme(storageKey) {
    const button = document.getElementById("themeToggle");
    if (!button) return;
    const apply = (theme) => {
        document.body.dataset.theme = theme;
        button.textContent = theme === "dark" ? "淺色模式" : "深色模式";
    };
    apply(localStorage.getItem(storageKey) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    button.onclick = () => {
        const next = document.body.dataset.theme === "dark" ? "light" : "dark";
        localStorage.setItem(storageKey, next);
        apply(next);
    };
}