// Copies the web app's production build (../build) into desktop/web so installers ship the
// interface and open instantly (served by localUi.js). Run `npm run build` at the repo root
// first, with the same REACT_APP_* settings as the website.
//
// If there is no build, or it was built without the Firebase config (sign-in would not work),
// this warns, removes desktop/web and exits 0: the app then opens the hosted site instead.
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "..", "..", "build");
const DEST = path.resolve(__dirname, "..", "web");

const skip = (why) => {
    fs.rmSync(DEST, { recursive: true, force: true });
    console.warn(`[bundle-web] ${why}\n[bundle-web] Not bundling the UI; the app will open the hosted site.`);
    process.exit(0);
};

if (!fs.existsSync(path.join(SRC, "index.html"))) skip(`No web build at ${SRC} (run "npm run build" in the repo root).`);

const jsDir = path.join(SRC, "static", "js");
const mainJs = fs.existsSync(jsDir) ? fs.readdirSync(jsDir).filter((f) => /^main\..*\.js$/.test(f)) : [];
if (!mainJs.length) skip("The build has no static/js/main.*.js.");
const hasFirebase = mainJs.some((f) => /firebaseapp\.com|AIza[0-9A-Za-z_-]{20,}/.test(fs.readFileSync(path.join(jsDir, f), "utf8")));
if (!hasFirebase) skip("The build has no Firebase config (set REACT_APP_FIREBASE_* before building).");

fs.rmSync(DEST, { recursive: true, force: true });
// Source maps would only bloat the installer.
fs.cpSync(SRC, DEST, { recursive: true, filter: (src) => !src.endsWith(".map") });

let files = 0;
let bytes = 0;
const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else { files++; bytes += fs.statSync(p).size; }
    }
};
walk(DEST);
console.log(`[bundle-web] Bundled ${files} files (${(bytes / 1024 / 1024).toFixed(1)} MB) into desktop/web.`);
