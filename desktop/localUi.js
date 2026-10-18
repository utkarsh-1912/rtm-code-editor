// Serves the bundled web UI (desktop/web, a copy of the React build) on this machine so the
// app opens instantly instead of waiting for the hosted server to wake up. Data, sockets and
// sign-in still go to the hosted server; the page learns its address from preload.js.
//
// Plain HTTP on http://localhost:<port> rather than a custom app:// scheme: Firebase popup
// sign-in only works on http(s) origins, and "localhost" is an authorized domain by default.
// The port is fixed so the origin (and with it the saved sign-in) stays the same between runs.
const http = require("http");
const fs = require("fs");
const path = require("path");

const WEB_DIR = path.join(__dirname, "web");
const PREFERRED_PORT = Number(process.env.COLABS_UI_PORT) || 47821;
const TRIES = 10;

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".webmanifest": "application/manifest+json",
};

const hasBundle = () => fs.existsSync(path.join(WEB_DIR, "index.html"));

function readFile(file) {
    try {
        const stat = fs.statSync(file);
        return stat.isFile() ? fs.readFileSync(file) : null;
    } catch {
        return null;
    }
}

function handler(port) {
    const hosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
    const index = () => readFile(path.join(WEB_DIR, "index.html"));
    return (req, res) => {
        // Only this app's own origin: blocks DNS-rebinding pages from reading the UI server.
        if (!hosts.has(String(req.headers.host || "").toLowerCase())) {
            res.writeHead(403, { "content-type": "text/plain" });
            return res.end("Forbidden");
        }
        if (req.method !== "GET" && req.method !== "HEAD") {
            res.writeHead(405, { allow: "GET, HEAD" });
            return res.end();
        }
        let rel;
        try {
            rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        } catch {
            res.writeHead(400);
            return res.end();
        }
        const file = path.resolve(WEB_DIR, "." + path.posix.normalize(rel));
        const insideWeb = file === WEB_DIR || file.startsWith(WEB_DIR + path.sep);
        let body = insideWeb && !rel.endsWith("/") ? readFile(file) : null;
        let type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
        let isIndex = false;

        if (!body) {
            // Client-side routes (/dashboard, /project/12) get the app; missing assets get a 404.
            if (path.extname(rel)) {
                res.writeHead(404, { "content-type": "text/plain" });
                return res.end("Not found");
            }
            body = index();
            type = TYPES[".html"];
            isIndex = true;
        }
        res.writeHead(200, {
            "content-type": type,
            "content-length": body.length,
            "x-content-type-options": "nosniff",
            "referrer-policy": "strict-origin-when-cross-origin",
            // Hashed build assets never change; the HTML must, after an update.
            "cache-control": isIndex || type === TYPES[".html"] ? "no-cache" : rel.startsWith("/static/") ? "public, max-age=31536000, immutable" : "public, max-age=3600",
        });
        res.end(req.method === "HEAD" ? undefined : body);
    };
}

function listen(port) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(handler(port));
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => resolve(server));
    });
}

// Resolves to { url, server } or null when there is no bundle or no free port.
async function startLocalUi() {
    if (!hasBundle()) return null;
    for (let i = 0; i < TRIES; i++) {
        const port = PREFERRED_PORT + i;
        try {
            const server = await listen(port);
            return { url: `http://localhost:${port}`, server };
        } catch (err) {
            if (err.code !== "EADDRINUSE" && err.code !== "EACCES") throw err;
        }
    }
    return null;
}

module.exports = { startLocalUi, hasBundle, WEB_DIR };
