import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Page numbers to show: first, last, current ±1, with gaps ("…").
function pageList(page, count) {
    const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
    const sorted = [...set].sort((a, b) => a - b);
    const out = [];
    sorted.forEach((p, i) => {
        if (i && p - sorted[i - 1] > 1) out.push("…");
        out.push(p);
    });
    return out;
}

// "Showing 13–24 of 57" with Prev / numbers / Next. When the server has more than what's
// loaded (`hasMore`), the last page offers "Load more" instead of Next.
export default function Pager({ page, pageSize, total, loaded, onPage, hasMore, onLoadMore, loadingMore, label = "items" }) {
    const shown = loaded ?? total;
    const count = Math.max(1, Math.ceil(shown / pageSize));
    if (total <= pageSize && !hasMore) return null;
    const from = shown ? (page - 1) * pageSize + 1 : 0;
    const to = Math.min(page * pageSize, shown);
    const atEnd = page >= count;
    return (
        <nav className="pager" aria-label={`${label} pages`}>
            <span className="pager-info">{from}–{to} of {total} {label}</span>
            <span className="pager-ctrls">
                <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={14} /></button>
                {pageList(page, count).map((p, i) => (p === "…"
                    ? <span key={`gap-${i}`} className="pager-gap">…</span>
                    : <button key={p} className={p === page ? "on" : ""} onClick={() => onPage(p)} aria-current={p === page ? "page" : undefined}>{p}</button>))}
                {atEnd && hasMore ? (
                    <button className="pager-more" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</button>
                ) : (
                    <button onClick={() => onPage(page + 1)} disabled={atEnd} aria-label="Next page"><ChevronRight size={14} /></button>
                )}
            </span>
        </nav>
    );
}
