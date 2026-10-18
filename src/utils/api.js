// The desktop app serves this UI from http://localhost:<port> (bundled, so it opens
// instantly) and tells the page where the real server and public site live.
const desktopConfig = () => (typeof window !== "undefined" && window.colabsDesktop?.config) || null;

const trim = (url) => {
    if (!url || url === "undefined" || url === "null" || url === "https:" || url === "http:") return null;
    return url.endsWith("/") ? url.slice(0, -1) : url;
};

// API + socket server.
export const getBackendUrl = () =>
    trim(desktopConfig()?.backendUrl) || trim(process.env.REACT_APP_BACKEND_URL) || window.location.origin;

// Address people open in a browser: used for invite and share links.
export const publicOrigin = () => trim(desktopConfig()?.publicUrl) || window.location.origin;
