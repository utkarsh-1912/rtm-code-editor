// Builds the srcdoc for a web project's preview from its files.
// Stylesheets and scripts that the HTML references by a local path are inlined; projects
// whose HTML references nothing (the starter template) get their first .css/.js injected.
// Console output reaches the parent through postMessage, so the iframe can stay sandboxed
// without allow-same-origin.

const CONSOLE_BRIDGE = `<script>
(function () {
  var send = function (type, args) {
    try {
      parent.postMessage({ type: type, log: Array.prototype.map.call(args, function (a) {
        if (a instanceof Error) return a.stack || String(a);
        if (typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return String(a); } }
        return String(a);
      }).join(' ') }, '*');
    } catch (e) { /* ignore */ }
  };
  ['log', 'info', 'warn', 'error'].forEach(function (k) {
    var orig = console[k];
    console[k] = function () {
      orig.apply(console, arguments);
      send(k === 'error' ? 'CONSOLE_ERROR' : k === 'warn' ? 'CONSOLE_WARN' : 'CONSOLE_LOG', arguments);
    };
  });
  window.addEventListener('error', function (e) {
    send('CONSOLE_ERROR', ['Uncaught ' + (e.message || 'error') + (e.lineno ? ' (line ' + e.lineno + ')' : '')]);
  });
  window.addEventListener('unhandledrejection', function (e) {
    send('CONSOLE_ERROR', ['Unhandled promise rejection: ' + (e.reason && e.reason.message || e.reason)]);
  });
})();
</script>`;

const DEFAULT_HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Web App</title></head><body><h1>Web App Preview</h1></body></html>';

const clean = (p) => String(p || "").replace(/\\/g, "/").replace(/^\.?\/+/, "");
const keyOf = (f) => clean(f.path || f.name);
const isExternal = (src) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(src);

// Resolve "../css/a.css" against the HTML file's folder.
function resolve(fromDir, ref) {
    const parts = (fromDir ? fromDir.split("/") : []).concat(clean(ref.split(/[?#]/)[0]).split("/"));
    const out = [];
    for (const p of parts) {
        if (!p || p === ".") continue;
        if (p === "..") out.pop();
        else out.push(p);
    }
    return out.join("/");
}

const safeScript = (js) => String(js).replace(/<\/script/gi, "<\\/script");
const safeStyle = (css) => String(css).replace(/<\/style/gi, "<\\/style");

function pickHtml(files, activeFile) {
    const html = files.filter((f) => /\.html?$/i.test(keyOf(f)));
    const active = activeFile && /\.html?$/i.test(keyOf(activeFile)) ? html.find((f) => keyOf(f) === keyOf(activeFile)) : null;
    return active
        || html.find((f) => keyOf(f).toLowerCase() === "index.html")
        || html.filter((f) => /(^|\/)index\.html?$/i.test(keyOf(f))).sort((a, b) => keyOf(a).length - keyOf(b).length)[0]
        || html[0]
        || null;
}

export function bundleWebProject(files = [], { activeFile } = {}) {
    const byPath = new Map(files.map((f) => [keyOf(f), f]));
    const htmlFile = pickHtml(files, activeFile);
    const dir = htmlFile ? keyOf(htmlFile).split("/").slice(0, -1).join("/") : "";
    let html = htmlFile?.content || DEFAULT_HTML;
    let linkedCss = false;
    let linkedJs = false;

    // <link rel="stylesheet" href="local.css">
    html = html.replace(/<link\b[^>]*>/gi, (tag) => {
        if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
        const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
        if (!href || isExternal(href)) return tag;
        const file = byPath.get(resolve(dir, href));
        if (!file) return tag;
        linkedCss = true;
        return `<style data-file="${keyOf(file)}">\n${safeStyle(file.content || "")}\n</style>`;
    });

    // <script src="local.js"></script>
    html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, before, src, after) => {
        if (isExternal(src)) return tag;
        const file = byPath.get(resolve(dir, src));
        if (!file) return tag;
        linkedJs = true;
        return `<script${before}${after} data-file="${keyOf(file)}">\n${safeScript(file.content || "")}\n</script>`;
    });

    // Starter projects reference nothing: inject the first stylesheet / script.
    const firstOf = (re, prefer) => byPath.get(prefer) || files.find((f) => re.test(keyOf(f)));
    const css = !linkedCss ? firstOf(/\.css$/i, "style.css") : null;
    const js = !linkedJs ? firstOf(/\.m?js$/i, "script.js") : null;
    const headExtra = `${CONSOLE_BRIDGE}${css ? `<style>\n${safeStyle(css.content || "")}\n</style>` : ""}`;
    const bodyExtra = js ? `<script>\n${safeScript(js.content || "")}\n</script>` : "";

    // Function replacers: "$&" etc. in user code must stay literal.
    if (/<head\b[^>]*>/i.test(html)) html = html.replace(/<head\b[^>]*>/i, (m) => m + headExtra);
    else html = headExtra + html;
    if (bodyExtra) {
        if (/<\/body>/i.test(html)) html = html.replace(/<\/body>(?![\s\S]*<\/body>)/i, () => `${bodyExtra}</body>`);
        else html += bodyExtra;
    }
    return html;
}
