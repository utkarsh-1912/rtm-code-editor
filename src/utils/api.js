export const getBackendUrl = () => {
    let url = process.env.REACT_APP_BACKEND_URL || window.location.origin;
    if (url.endsWith("/")) url = url.slice(0, -1);
    // Ensure it doesn't just result in "https:" or similar malformed strings
    if (url === "https:" || url === "http:") url = window.location.origin;
    return url;
};
