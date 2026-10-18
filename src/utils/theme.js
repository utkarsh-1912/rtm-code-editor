// Theme preference: "dark" | "light" | "system", stored under "app-theme".
const KEY = "app-theme";

export const getThemePref = () => {
    try { return localStorage.getItem(KEY) || "dark"; } catch { return "dark"; }
};

export const resolveTheme = (pref = getThemePref()) => {
    if (pref === "system") {
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    return pref === "light" ? "light" : "dark";
};

export const applyTheme = (pref = getThemePref()) => {
    const isLight = resolveTheme(pref) === "light";
    document.documentElement.classList.toggle("light-theme", isLight);
    window.dispatchEvent(new CustomEvent("app-theme-change", { detail: { isLight } }));
    return isLight;
};

export const setThemePref = (pref) => {
    try { localStorage.setItem(KEY, pref); } catch { /* storage blocked */ }
    return applyTheme(pref);
};
