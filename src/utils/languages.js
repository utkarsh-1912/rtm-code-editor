import catalogue from "../shared/languages.json";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";
import { php } from "@codemirror/lang-php";
import { StreamLanguage } from "@codemirror/language";
import { java, csharp, kotlin, c as cMode } from "@codemirror/legacy-modes/mode/clike";
import { go } from "@codemirror/legacy-modes/mode/go";
import { rust } from "@codemirror/legacy-modes/mode/rust";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { r } from "@codemirror/legacy-modes/mode/r";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { standardSQL } from "@codemirror/legacy-modes/mode/sql";

// Runnable languages, shared with the code runner (src/shared/languages.json).
export const LANGS = catalogue.languages;
export const LANG_BY_ID = Object.fromEntries(LANGS.map((l) => [l.id, l]));

// Languages a snippet can be saved as: every runnable one plus markup.
export const SNIPPET_LANGS = [
    ...LANGS.map((l) => [l.id, l.label, l.short]),
    ["html", "HTML", "htm"],
    ["css", "CSS", "css"],
];

const BY_EXT = Object.fromEntries(LANGS.flatMap((l) => l.ext.map((e) => [e, l.id])));

// "main.rs" -> "rust"; unknown extensions -> null.
export const languageForFile = (name = "") => BY_EXT[String(name).split(".").pop().toLowerCase()] || null;
export const fileNameFor = (id) => LANG_BY_ID[id]?.file || `main.${id || "txt"}`;
export const templateFor = (id) => LANG_BY_ID[id]?.template || "";
export const labelFor = (id) => LANG_BY_ID[id]?.label || id;
export const isTemplate = (code) => !String(code || "").trim() || LANGS.some((l) => l.template.trim() === String(code).trim());

const legacy = (mode) => StreamLanguage.define(mode);
const EXTENSIONS = {
    javascript: () => javascript({ jsx: true }),
    typescript: () => javascript({ jsx: true, typescript: true }),
    python: () => python(),
    c: () => legacy(cMode),
    cpp: () => cpp(),
    java: () => legacy(java),
    csharp: () => legacy(csharp),
    kotlin: () => legacy(kotlin),
    go: () => legacy(go),
    rust: () => legacy(rust),
    php: () => php(),
    ruby: () => legacy(ruby),
    swift: () => legacy(swift),
    lua: () => legacy(lua),
    r: () => legacy(r),
    bash: () => legacy(shell),
    sql: () => legacy(standardSQL),
    html: () => html(),
    htmlmixed: () => html(),
    css: () => html(),
};

// CodeMirror support for a language id or file extension (falls back to plain JS rules).
export const editorLanguage = (idOrExt) => {
    const id = EXTENSIONS[idOrExt] ? idOrExt : BY_EXT[idOrExt] || (idOrExt === "html" || idOrExt === "css" ? idOrExt : null);
    return (EXTENSIONS[id] || EXTENSIONS.javascript)();
};
