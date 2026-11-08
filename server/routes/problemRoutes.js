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

// The TeX Codeforces writes maths in, as plain characters.
const TEX = { leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', lt: '<', gt: '>', cdot: '·', times: '×', ldots: '…', dots: '…', cdots: '⋯', pm: '±', infty: '∞', to: '→', rightarrow: '→', leftarrow: '←', sum: 'Σ', prod: 'Π', oplus: '⊕', in: '∈', notin: '∉', subseteq: '⊆', cup: '∪', cap: '∩', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', sqrt: '√', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', phi: 'φ', omega: 'ω', land: '∧', lor: '∨', neg: '¬', mid: '|', ',': ' ', ';': ' ', quad: ' ', qquad: '  ' };
function texToText(s) {
    return s
        .replace(/\\(?:texttt|textbf|textit|text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g, '$1')
        .replace(/\\(?:frac)\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
        .replace(/\^\{([^{}]*)\}/g, '^$1').replace(/_\{([^{}]*)\}/g, '_$1')
        .replace(/\\([a-zA-Z]+|[,;])/g, (m, name) => (TEX[name] !== undefined ? TEX[name] : m))
        .replace(/\\([{}])/g, '$1');
}

// Problem HTML to the plain text the Problem pane formats (``` blocks, "- " lists, `code`,
// ![image](url) for pictures).
function htmlToText(html) {
    let s = String(html || '');
    s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, body) => `\n\`\`\`\n${decode(body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim()}\n\`\`\`\n`);
    s = s.replace(/<sup>(.*?)<\/sup>/gi, '^$1').replace(/<sub>(.*?)<\/sub>/gi, '_$1');
    s = s.replace(/<code>(.*?)<\/code>/gi, (_, c) => `\`${c.replace(/<[^>]+>/g, '')}\``);
    s = s.replace(/<li[^>]*>/gi, '\n- ').replace(/<\/(p|div|ul|ol|h\d)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
    s = s.replace(/<img[^>]*?src="([^"]+)"[^>]*>/gi, (_, src) => `\n![image](${src.startsWith('//') ? `https:${src}` : src})\n`);
    s = s.replace(/<[^>]+>/g, '');
    s = texToText(decode(s).replace(/\$\$\$/g, ''));
    return s.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function getJson(url, init = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), init.timeout || 10000);
    try {
        const { timeout, text, ...rest } = init;
        const res = await fetch(url, { ...rest, signal: ctrl.signal, headers: { 'User-Agent': UA, ...(init.headers || {}) } });
        if (!res.ok) throw Object.assign(new Error(`The site answered ${res.status}.`), { status: 502, httpStatus: res.status });
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
    let harness = null; // { name, params: [{ name, type }], ret } for LeetCode mode (not for design problems)
    try {
        const meta = JSON.parse(q.metaData || '{}');
        params = Math.max(1, (meta.params || []).length || 1);
        if (meta.name && Array.isArray(meta.params) && !meta.systemdesign && !meta.classname) {
            harness = { name: meta.name, params: meta.params.map((p) => ({ name: p.name, type: p.type })), ret: meta.return?.type || 'void' };
        }
    } catch { /* keep 1 */ }
    const lines = String(q.exampleTestcases || '').split('\n').filter((l) => l.trim() !== '');
    const outputs = [...text.matchAll(/^Output:\s*`?([^`\n]*)`?/gim)].map((m) => m[1].trim());
    const tests = [];
    for (let i = 0; i + params <= lines.length && tests.length < 10; i += params) {
        tests.push({ input: lines.slice(i, i + params).join('\n'), output: outputs[tests.length] || '' });
    }
    return {
        source: 'LeetCode', url: `https://leetcode.com/problems/${slug}/`,
        title: `${q.questionFrontendId}. ${q.title}`, difficulty: q.difficulty, tags: (q.topicTags || []).map((t) => t.name),
        text, starters, tests, harness,
    };
}

// Every Codeforces problem's name, rating and tags (one public list, refreshed every 6 hours).
let cfSet = { at: 0, byKey: new Map(), loading: null };
async function cfMeta(contest, index) {
    if (Date.now() - cfSet.at > 6 * 60 * 60 * 1000 && !cfSet.loading) {
        cfSet.loading = getJson('https://codeforces.com/api/problemset.problems').then((d) => {
            const byKey = new Map();
            for (const p of d?.result?.problems || []) byKey.set(`${p.contestId}${String(p.index).toUpperCase()}`, p);
            if (byKey.size) cfSet = { at: Date.now(), byKey, loading: null };
            else cfSet.loading = null;
        }).catch(() => { cfSet.loading = null; });
    }
    if (cfSet.loading && !cfSet.byKey.size) await cfSet.loading;
    return cfSet.byKey.get(`${contest}${String(index).toUpperCase()}`) || null;
}

// A Codeforces problem page with its statement: the problemset page, then the contest page,
// twice over with a short pause between tries (Codeforces is often slow or busy for a moment).
// { html } on success; { missing: true } when every answer was "not found"; {} otherwise.
async function codeforcesPage(contest, index, gym) {
    const paths = gym
        ? [`/gym/${contest}/problem/${index}`]
        : [`/problemset/problem/${contest}/${index}`, `/contest/${contest}/problem/${index}`];
    const tries = [...paths, ...paths].map((p) => `https://codeforces.com${p}`);
    let notFound = 0;
    for (let i = 0; i < tries.length; i++) {
        try {
            const html = await getJson(tries[i], { text: true, timeout: 15000 });
            if (/problem-statement/.test(html)) return { html };
        } catch (err) {
            if (err.httpStatus === 404) notFound++;
        }
        if (i < tries.length - 1) await new Promise((r) => setTimeout(r, 700 + i * 500));
    }
    return notFound === tries.length ? { missing: true } : {};
}

async function codeforces(contest, index, gym = false) {
    const url = gym ? `https://codeforces.com/gym/${contest}/problem/${index}` : `https://codeforces.com/problemset/problem/${contest}/${index}`;
    // The page and the name/rating/tags list load side by side.
    const [page, p] = await Promise.all([
        codeforcesPage(contest, index, gym),
        gym ? null : cfMeta(contest, index).catch(() => null),
    ]);
    const html = page.html;
    if (page.missing) throw Object.assign(new Error('Codeforces has no problem at that link.'), { status: 404 });
    let text = '';
    let pageTitle = null;
    const tests = [];
    try {
        if (!html) throw new Error('no statement');
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
                .replace(/<div class="sample-tests?">[\s\S]*$/i, '')
                .replace(/<div class="section-title">\s*Examples?\s*<\/div>/gi, '')
                .replace(/<div class="title">([\s\S]*?)<\/div>/gi, '\n### $1\n')
                .replace(/<div class="(time|memory)-limit">[\s\S]*?<\/div><\/div>/gi, '')
                .replace(/<div class="(input|output)">/gi, '\n'));
            text = text.replace(/^###\s*[A-Z]\d?\.\s.*\n?/, '').replace(/\n+(Examples?|Note)\s*$/i, ''); // the title is shown separately
            const note = /<div class="note">([\s\S]*?)<\/div>\s*<\/div>/i.exec(m[1]);
            if (note) text += `\n\n${htmlToText(note[1].replace(/<div class="section-title">[\s\S]*?<\/div>/i, '### Note\n'))}`;
        }
    } catch { /* reported below */ }
    if (!text) {
        // Never fill the pane with a stub: say what happened (with the link, to copy it by hand).
        throw Object.assign(new Error('Codeforces isn’t answering this server right now. Try again in a moment, or open the problem and paste it.'), { status: 502, openUrl: url });
    }
    return {
        source: 'Codeforces', url,
        title: p ? `${contest}${p.index}. ${p.name}` : pageTitle ? `${contest}${pageTitle}` : `${contest}${index}`, difficulty: p?.rating ? String(p.rating) : null, tags: p?.tags || [],
        text, starters: {}, tests,
    };
}

// A whole contest: its name and problems ({ label, title, url }), to import one at a time.
async function codeforcesContest(contest, gym = false) {
    const base = `https://codeforces.com/${gym ? 'gym' : 'contest'}/${contest}`;
    const html = await getJson(base, { text: true });
    const name = /<th[^>]*class="left"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i.exec(html)?.[1] || /<title>([^<]+)<\/title>/i.exec(html)?.[1] || `Contest ${contest}`;
    const seen = new Set();
    const problems = [];
    const re = new RegExp(`<a href="/${gym ? 'gym' : 'contest'}/${contest}/problem/([A-Z][0-9]?)"[^>]*>\\s*<!--[^>]*-->\\s*([^<]*)<`, 'gi');
    for (const m of html.matchAll(new RegExp(`/${gym ? 'gym' : 'contest'}/${contest}/problem/([A-Z][0-9]?)"`, 'gi'))) {
        const label = m[1].toUpperCase();
        if (seen.has(label)) continue;
        seen.add(label);
        problems.push({ label, title: '', url: `${base}/problem/${label}` });
    }
    for (const m of html.matchAll(re)) {
        const p = problems.find((x) => x.label === m[1].toUpperCase());
        if (p && m[2].trim() && !p.title) p.title = decode(m[2].trim());
    }
    // Names from the problem set where the page didn't give them.
    if (!gym) for (const p of problems) if (!p.title) p.title = (await cfMeta(contest, p.label).catch(() => null))?.name || '';
    if (!problems.length) throw Object.assign(new Error('Codeforces has no contest at that link, or it hasn’t started.'), { status: 404 });
    return { kind: 'contest', source: 'Codeforces', url: base, title: decode(name.replace(/\s*-\s*Codeforces\s*$/i, '').trim()), problems: problems.slice(0, 30) };
}

async function leetcodeContest(slug) {
    const data = await getJson('https://leetcode.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Referer: `https://leetcode.com/contest/${slug}/` },
        body: JSON.stringify({ query: 'query q($titleSlug: String!) { contestQuestionList(contestSlug: $titleSlug) { title titleSlug credit } }', variables: { titleSlug: slug } }),
    });
    const list = data?.data?.contestQuestionList || [];
    if (!list.length) throw Object.assign(new Error('LeetCode has no contest at that link, or its problems aren’t public yet.'), { status: 404 });
    const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return {
        kind: 'contest', source: 'LeetCode', url: `https://leetcode.com/contest/${slug}/`, title,
        problems: list.map((q, i) => ({ label: `Q${i + 1}`, title: q.title, url: `https://leetcode.com/problems/${q.titleSlug}/` })),
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
        const path = u.pathname;
        const isLc = host === 'leetcode.com' || host === 'leetcode.cn';
        const isCf = host === 'codeforces.com' || host === 'm1.codeforces.com' || host === 'm2.codeforces.com';
        // LeetCode: /problems/<slug>, /contest/<contest>/problems/<slug>, /contest/<contest>
        const lcProblem = /^\/(?:contest\/[a-z0-9-]+\/)?problems\/([a-z0-9-]+)/i.exec(path);
        const lcContest = /^\/contest\/([a-z0-9-]+)\/?$/i.exec(path);
        // Codeforces: /problemset/problem/<c>/<i>, /contest/<c>/problem/<i>, /gym/<c>/problem/<i>, /contest/<c>, /gym/<c>
        const cfProblem = /^\/(problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([A-Z]\d?)\/?$/i.exec(path);
        const cfContest = /^\/(contest|gym)\/(\d+)(?:\/problems)?\/?$/i.exec(path);
        if (isLc && lcProblem) p = await leetcode(lcProblem[1].toLowerCase());
        else if (isLc && lcContest) p = await leetcodeContest(lcContest[1].toLowerCase());
        else if (isCf && cfProblem) p = await codeforces(cfProblem[2], cfProblem[3].toUpperCase(), cfProblem[1].toLowerCase() === 'gym');
        else if (isCf && cfContest) p = await codeforcesContest(cfContest[2], cfContest[1].toLowerCase() === 'gym');
        else return res.status(400).json({ error: 'Paste a LeetCode or Codeforces problem or contest link.' });
        const data = p.kind === 'contest' ? p : { ...p, pane: toPane(p) };
        cache.set(u.href, { at: Date.now(), data });
        if (cache.size > 500) cache.delete(cache.keys().next().value);
        res.json(data);
    } catch (err) {
        res.status(err.status || 502).json({
            error: err.name === 'AbortError' ? 'The site took too long to answer. Try again.' : (err.message || 'Could not import that problem.'),
            ...(err.openUrl ? { openUrl: err.openUrl } : {}),
        });
    }
});

module.exports = router;
module.exports.htmlToText = htmlToText;
