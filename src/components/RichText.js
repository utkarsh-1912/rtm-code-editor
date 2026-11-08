import React from "react";

// Renders the Markdown that AI models reply with (headings, lists, quotes, code, bold, italic,
// inline code, links) as React elements. Never uses innerHTML, so a reply can't inject markup.

const SAFE_URL = /^https?:\/\//i;

// **bold**, *italic* / _italic_, `code`, [text](https://…)
function inline(text, keyBase = "i") {
    const out = [];
    const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)|(\[[^\]\n]+\]\([^)\s]+\))/g;
    let last = 0;
    let m;
    let n = 0;
    while ((m = re.exec(text))) {
        if (m.index > last) out.push(text.slice(last, m.index));
        const tok = m[0];
        const key = `${keyBase}-${n++}`;
        if (m[1]) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
        else if (m[2]) out.push(<strong key={key}>{inline(tok.slice(2, -2), key)}</strong>);
        else if (m[3]) out.push(<em key={key}>{inline(tok.slice(1, -1), key)}</em>);
        else {
            const [, label, url] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
            out.push(SAFE_URL.test(url) ? <a key={key} href={url} target="_blank" rel="noreferrer noopener">{label}</a> : label);
        }
        last = m.index + tok.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

function blocks(src) {
    const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let i = 0;
    const isList = (l) => /^\s*([-*+]|\d+[.)])\s+/.test(l);
    const isSpecial = (l) => /^\s*(```|#{1,6}\s|>|([-*_])\s*\2\s*\2\s*$)/.test(l) || isList(l);
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }
        const fence = /^\s*```\s*([\w+#.-]*)/.exec(line);
        if (fence) {
            const body = [];
            i++;
            while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
            i++;
            out.push({ type: "code", lang: fence[1], text: body.join("\n") });
            continue;
        }
        const h = /^(#{1,6})\s+(.*)$/.exec(line.trim());
        if (h) { out.push({ type: "h", level: Math.min(4, h[1].length + 2), text: h[2].replace(/#+\s*$/, "") }); i++; continue; }
        if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) { out.push({ type: "hr" }); i++; continue; }
        if (/^\s*>/.test(line)) {
            const body = [];
            while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ""));
            out.push({ type: "quote", text: body.join(" ") });
            continue;
        }
        if (isList(line)) {
            const ordered = /^\s*\d+[.)]/.test(line);
            const items = [];
            while (i < lines.length && (isList(lines[i]) || (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length))) {
                if (isList(lines[i])) items.push(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ""));
                else items[items.length - 1] += ` ${lines[i].trim()}`; // a wrapped item
                i++;
            }
            out.push({ type: ordered ? "ol" : "ul", items });
            continue;
        }
        const body = [];
        while (i < lines.length && lines[i].trim() && !isSpecial(lines[i])) body.push(lines[i++].trim());
        out.push({ type: "p", text: body.join("\n") });
    }
    return out;
}

export default function RichText({ text, className = "" }) {
    return (
        <div className={`rt ${className}`.trim()}>
            {blocks(text).map((b, k) => {
                if (b.type === "code") return <pre key={k} className="rt-code"><code>{b.text}</code></pre>;
                if (b.type === "h") { const H = `h${b.level}`; return <H key={k}>{inline(b.text, `h${k}`)}</H>; }
                if (b.type === "hr") return <hr key={k} />;
                if (b.type === "quote") return <blockquote key={k}>{inline(b.text, `q${k}`)}</blockquote>;
                if (b.type === "ul" || b.type === "ol") {
                    const L = b.type;
                    return <L key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, `l${k}-${j}`)}</li>)}</L>;
                }
                return <p key={k}>{inline(b.text, `p${k}`)}</p>;
            })}
        </div>
    );
}
