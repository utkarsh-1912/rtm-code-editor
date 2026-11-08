// Brings a problem into a room's Problem pane from a link: LeetCode (its public GraphQL) or
// Codeforces (its public API for the title and tags, the problem page for the statement).
// Rooms are for working together, so this only fetches the statement and starter code.
const express = require('express');
const router = express.Router();

const cache = new Map(); // url -> { at, data }
const TTL = 60 * 60 * 1000;
const UA = 'UtkristiCoLabs/1.0 (problem import)';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', le: '≤', ge: '≥', ne: '≠', times: '×', minus: '−', hellip: '…', rarr: '→', larr: '←' };
const decode = (s) => s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

// Problem HTML to the plain text the Problem pane formats (``` blocks, "- " lists, `code`).
function htmlToText(html) {
    let s = String(html || '');
    s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, body) => `\n\`\`\`\n${decode(body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim()}\n\`\`\`\n`);
    s = s.replace(/<sup>(.*?)<\/sup>/gi, '^$1').replace(/<sub>(.*?)<\/sub>/gi, '_$1');
    s = s.replace(/<code>(.*?)<\/code>/gi, (_, c) => `\`${c.replace(/<[^>]+>/g, '')}\``);
    s = s.replace(/<li[^>]*>/gi, '\n- ').replace(/<\/(p|div|ul|ol|h\d)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
    s = s.replace(/<img[^>]*>/gi, '[image]').replace(/<[^>]+>/g, '');
    s = decode(s).replace(/\$\$\$/g, '');
    return s.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function getJson(url, init = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
        const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': UA, ...(init.headers || {}) } });
        if (!res.ok) throw Object.assign(new Error(`The site answered ${res.status}.`), { status: 502 });
        return init.text ? await res.text() : await res.json();
    } finally { clearTimeout(t); }
}

async function leetcode(slug) {
    const query = `query q($titleSlug: String!) { question(titleSlug: $titleSlug) { questionFrontendId title difficulty content isPaidOnly exampleTestcases metaData topicTags { name } codeSnippets { langSlug code } } }`;
    const data = await getJson('https://leetcode.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Referer: `https://leetcode.com/problems/${slug}/` },
        body: JSON.stringify({ query, variables: { titleSlug: slug } }),
    });
    const q = data?.data?.question;
    if (!q) throw Object.assign(new Error('LeetCode has no problem at that link.'), { status: 404 });
    if (q.isPaidOnly || !q.content) throw Object.assign(new Error('That LeetCode problem is for Premium members, so its text can’t be imported. Paste it instead.'), { status: 403 });
    const starters = {};
    for (const s of q.codeSnippets || []) starters[s.langSlug] = s.code;
    const text = htmlToText(q.content);
    // Example tests: LeetCode lists each case's arguments one per line; the expected outputs
    // come from the statement's "Output:" lines, in order.
    let params = 1;
    try { params = Math.max(1, (JSON.parse(q.metaData || '{}').params || []).length || 1); } catch { /* keep 1 */ }
    const lines = String(q.exampleTestcases || '').split('\n').filter((l) => l.trim() !== '');
    const outputs = [...text.matchAll(/^Output:\s*`?([^`\n]*)`?/gim)].map((m) => m[1].trim());
    const tests = [];
    for (let i = 0; i + params <= lines.length && tests.length < 10; i += params) {
        tests.push({ input: lines.slice(i, i + params).join('\n'), output: outputs[tests.length] || '' });
    }
    return {
        source: 'LeetCode', url: `https://leetcode.com/problems/${slug}/`,
        title: `${q.questionFrontendId}. ${q.title}`, difficulty: q.difficulty, tags: (q.topicTags || []).map((t) => t.name),
        text, starters, tests,
    };
}

async function codeforces(contest, index) {
    const meta = await getJson(`https://codeforces.com/api/contest.standings?contestId=${contest}&from=1&count=1`).catch(() => null);
    const p = meta?.result?.problems?.find((x) => String(x.index).toUpperCase() === index.toUpperCase());
    const url = `https://codeforces.com/problemset/problem/${contest}/${index}`;
    let text = '';
    let pageTitle = null;
    const tests = [];
    try {
        const html = await getJson(url, { text: true });
        const m = /<div class="problem-statement">([\s\S]*?)<\/div>\s*<\/div>\s*<script/i.exec(html) || /<div class="problem-statement">([\s\S]*)/i.exec(html);
        const t = /<div class="title">\s*([A-Z]\d?\.\s*[^<]+)<\/div>/i.exec(html);
        if (t) pageTitle = decode(t[1].trim());
        // Sample tests: each input's <pre> and the output <pre> after it.
        const pre = (h) => decode(h.replace(/<\/div>\s*<div[^>]*>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/^\n+|\s+$/g, '');
        const ins = [...html.matchAll(/<div class="input">[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/gi)].map((x) => pre(x[1]));
        const outs = [...html.matchAll(/<div class="output">[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/gi)].map((x) => pre(x[1]));
        ins.slice(0, 10).forEach((input, i) => tests.push({ input, output: outs[i] || '' }));
        if (m) {
            text = htmlToText(m[1]
                .replace(/<div class="title">([\s\S]*?)<\/div>/gi, '\n### $1\n')
                .replace(/<div class="(time|memory)-limit">[\s\S]*?<\/div><\/div>/gi, '')
                .replace(/<div class="(input|output)">/gi, '\n'));
            text = text.replace(/^###\s*[A-Z]\d?\.\s.*\n?/, ''); // the title, shown separately
        }
    } catch { /* the site may block automated reads: keep the link */ }
    if (!p && !text) throw Object.assign(new Error('Codeforces has no problem at that link.'), { status: 404 });
    return {
        source: 'Codeforces', url,
        title: p ? `${contest}${p.index}. ${p.name}` : pageTitle ? `${contest}${pageTitle}` : `${contest}${index}`, difficulty: p?.rating ? String(p.rating) : null, tags: p?.tags || [],
        text: text || `Read the statement on Codeforces: ${url}`, starters: {}, tests,
    };
}

// The Problem pane's text: title, details, statement, link.
function toPane(p) {
    const head = [`# ${p.title}`, [p.difficulty, ...p.tags.slice(0, 6)].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
    return `${head}\n\n${p.text}\n\nSource: ${p.source} · ${p.url}`.slice(0, 20000);
}

router.get('/problems/import', async (req, res) => {
    try {
        const raw = String(req.query.url || '').trim();
        let u;
        try { u = new URL(raw); } catch { return res.status(400).json({ error: 'Paste a LeetCode or Codeforces problem link.' }); }
        const host = u.hostname.replace(/^www\./, '');
        const hit = cache.get(u.href);
        if (hit && Date.now() - hit.at < TTL) return res.json(hit.data);
        let p;
        const lc = /^\/problems\/([a-z0-9-]+)/i.exec(u.pathname);
        const cf = /^\/(?:problemset\/problem|contest)\/(\d+)\/(?:problem\/)?([A-Z]\d?)/i.exec(u.pathname);
        if ((host === 'leetcode.com' || host === 'leetcode.cn') && lc) p = await leetcode(lc[1].toLowerCase());
        else if ((host === 'codeforces.com' || host === 'm1.codeforces.com') && cf) p = await codeforces(cf[1], cf[2]);
        else return res.status(400).json({ error: 'Only LeetCode and Codeforces problem links can be imported for now.' });
        const data = { ...p, pane: toPane(p) };
        cache.set(u.href, { at: Date.now(), data });
        if (cache.size > 500) cache.delete(cache.keys().next().value);
        res.json(data);
    } catch (err) {
        res.status(err.status || 502).json({ error: err.name === 'AbortError' ? 'The site took too long to answer. Try again.' : (err.message || 'Could not import that problem.') });
    }
});

module.exports = router;
module.exports.htmlToText = htmlToText;
