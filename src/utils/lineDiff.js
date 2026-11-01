// Line-by-line diff (longest common subsequence): what changed from `before` to `after`.
// Returns rows { type: "same" | "add" | "del", text, a, b } where a/b are 1-based line numbers
// in before/after (null when the line isn't on that side).
export function lineDiff(before = "", after = "") {
    const a = before.split("\n");
    const b = after.split("\n");
    // Trim the shared start and end first: snapshots mostly differ in a few places.
    let head = 0;
    while (head < a.length && head < b.length && a[head] === b[head]) head++;
    let tail = 0;
    while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
    const midA = a.slice(head, a.length - tail);
    const midB = b.slice(head, b.length - tail);

    const rows = [];
    for (let i = 0; i < head; i++) rows.push({ type: "same", text: a[i], a: i + 1, b: i + 1 });

    if (midA.length * midB.length > 4_000_000) {
        // Too big to compare line by line in the browser: show it as replaced.
        midA.forEach((t, i) => rows.push({ type: "del", text: t, a: head + i + 1, b: null }));
        midB.forEach((t, j) => rows.push({ type: "add", text: t, a: null, b: head + j + 1 }));
    } else {
        const n = midA.length, m = midB.length;
        const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
        for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
                lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
            }
        }
        let i = 0, j = 0;
        while (i < n || j < m) {
            if (i < n && j < m && midA[i] === midB[j]) { rows.push({ type: "same", text: midA[i], a: head + i + 1, b: head + j + 1 }); i++; j++; }
            // Removed lines come before the added lines that replace them.
            else if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) { rows.push({ type: "del", text: midA[i], a: head + i + 1, b: null }); i++; }
            else { rows.push({ type: "add", text: midB[j], a: null, b: head + j + 1 }); j++; }
        }
    }

    for (let k = tail; k > 0; k--) rows.push({ type: "same", text: a[a.length - k], a: a.length - k + 1, b: b.length - k + 1 });
    return rows;
}

// Changed rows with `context` unchanged lines around each change; long unchanged runs become
// { type: "gap", count } so a small change in a long file stays readable.
export function withContext(rows, context = 3) {
    const keep = rows.map(() => false);
    rows.forEach((r, i) => {
        if (r.type === "same") return;
        for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep[k] = true;
    });
    const out = [];
    let skipped = 0;
    rows.forEach((r, i) => {
        if (keep[i]) {
            if (skipped) { out.push({ type: "gap", count: skipped }); skipped = 0; }
            out.push(r);
        } else skipped++;
    });
    if (skipped) out.push({ type: "gap", count: skipped });
    return out;
}
