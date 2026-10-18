import React from "react";
import { NavLink } from "react-router-dom";
import SiteLayout, { PageHead } from "./Site/SiteLayout";

const DOCS = [["Privacy", "/privacy"], ["Terms", "/terms"], ["Security", "/security"]];

// Long-form pages (legal, account notices): giant title, side index, readable prose column.
export default function ContentLayout({ title, label = "Legal", updated, children }) {
    const words = title.split(" ");
    const lines = words.length > 2 ? [words.slice(0, -1).join(" "), `${words[words.length - 1]}.`] : [`${title}.`];
    return (
        <SiteLayout>
            <PageHead label={label} title={lines} />
            <div className="u-head">
                <aside className="c-side" data-rise>
                    {updated && <span className="u-label">Updated {updated}</span>}
                    {label === "Legal" && (
                        <nav className="g-index" aria-label="Legal documents">
                            {DOCS.map(([l, to], i) => (
                                <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "on" : "")}>
                                    <span>{String(i + 1).padStart(2, "0")}</span><span>{l}</span>
                                </NavLink>
                            ))}
                        </nav>
                    )}
                </aside>
                <article className="u-prose" data-rise style={{ "--d": "80ms" }}>{children}</article>
            </div>
        </SiteLayout>
    );
}
