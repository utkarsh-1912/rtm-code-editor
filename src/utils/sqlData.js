// Turns imported CSV / TSV / JSON files into plain SQL (CREATE TABLE + INSERT) that is
// prepended to the user's query. Because it is only SQL text it works on every runner
// engine (server, local Judge0, desktop) with no file upload support needed.

export const MAX_FILE_BYTES = 400 * 1024;
export const MAX_ROWS = 5000;

// RFC 4180 parser: quoted fields, escaped quotes, CRLF, custom delimiter.
export function parseDelimited(text, delimiter = ",") {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    const src = text.replace(/^﻿/, "");
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (quoted) {
            if (c === '"') {
                if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
            } else field += c;
        } else if (c === '"' && field === "") quoted = true;
        else if (c === delimiter) { row.push(field); field = ""; }
        else if (c === "\n" || c === "\r") {
            if (c === "\r" && src[i + 1] === "\n") i++;
            row.push(field); field = "";
            if (row.length > 1 || row[0] !== "") rows.push(row);
            row = [];
        } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
}

const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;
export const tableNameFrom = (filename) => {
    const base = filename.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    return /^[A-Za-z_]/.test(base) ? base : `t_${base || "data"}`;
};

function uniqueHeaders(raw) {
    const seen = new Set();
    return raw.map((h, i) => {
        let name = String(h ?? "").trim().replace(/\s+/g, "_") || `col${i + 1}`;
        while (seen.has(name.toLowerCase())) name += "_";
        seen.add(name.toLowerCase());
        return name;
    });
}

function inferType(values) {
    const present = values.filter((v) => v !== "" && v != null);
    if (!present.length) return "TEXT";
    if (present.every((v) => /^-?\d+$/.test(String(v)) && String(v).length < 16 && !/^-?0\d/.test(String(v)))) return "INTEGER";
    if (present.every((v) => /^-?\d*\.?\d+(e[+-]?\d+)?$/i.test(String(v)))) return "REAL";
    return "TEXT";
}

// -> { name, columns: [{name,type}], rows: [[...]], truncated }
export function parseDataFile(filename, text) {
    const ext = (filename.split(".").pop() || "").toLowerCase();
    let headers;
    let rows;
    if (ext === "json") {
        const data = JSON.parse(text);
        const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : null;
        if (!list || !list.length || typeof list[0] !== "object") throw new Error("JSON must be an array of objects");
        headers = uniqueHeaders([...new Set(list.flatMap((o) => Object.keys(o || {})))]);
        const keys = [...new Set(list.flatMap((o) => Object.keys(o || {})))];
        rows = list.map((o) => keys.map((k) => { const v = o?.[k]; return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); }));
    } else {
        const delimiter = ext === "tsv" || ext === "tab" ? "\t" : ext === "psv" ? "|" : (text.split("\n")[0].split("\t").length > text.split("\n")[0].split(",").length ? "\t" : ",");
        const all = parseDelimited(text, delimiter);
        if (all.length < 1) throw new Error("The file is empty");
        headers = uniqueHeaders(all[0]);
        rows = all.slice(1).map((r) => headers.map((_, i) => r[i] ?? ""));
    }
    const truncated = rows.length > MAX_ROWS;
    if (truncated) rows = rows.slice(0, MAX_ROWS);
    const columns = headers.map((name, i) => ({ name, type: inferType(rows.map((r) => r[i])) }));
    return { name: tableNameFrom(filename), columns, rows, truncated };
}

const literal = (v, type) => {
    if (v === "" || v == null) return "NULL";
    if (type === "INTEGER" || type === "REAL") return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
};

export function tableToSql(t) {
    const cols = t.columns.map((c) => `${ident(c.name)} ${c.type}`).join(", ");
    const out = [`DROP TABLE IF EXISTS ${ident(t.name)};`, `CREATE TABLE ${ident(t.name)} (${cols});`];
    for (let i = 0; i < t.rows.length; i += 200) {
        const chunk = t.rows.slice(i, i + 200)
            .map((r) => `(${r.map((v, j) => literal(v, t.columns[j].type)).join(",")})`).join(",");
        out.push(`INSERT INTO ${ident(t.name)} VALUES ${chunk};`);
    }
    return out.join("\n");
}

// Everything that must run before the user's query.
export const buildSqlPrelude = (tables) => [".headers on", ".mode column", ...tables.map(tableToSql), ""].join("\n");
