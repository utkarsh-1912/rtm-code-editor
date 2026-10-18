// Languages the runner accepts. Names, Judge0 ids and file names come from the shared
// catalogue (src/shared/languages.json) so the web app and runner never drift apart.
// Local commands are used only when no Judge0 instance answers; a toolchain that isn't
// installed on the runner machine reports "<tool> is not installed".
const path = require("path");
const { languages: CATALOGUE } = require("../../src/shared/languages.json");

const isWin = process.platform === "win32";
const exe = (name) => (isWin ? `${name}.exe` : name);
const env = (key, fallback) => process.env[key] || fallback;
const binary = (dir) => path.join(dir, exe("main"));

// id -> { compile?(dir), run(dir) } for the local engine. Missing = Judge0 only.
const LOCAL = {
    javascript: { run: () => ({ cmd: process.execPath, args: ["main.js"] }) },
    typescript: { run: () => ({ cmd: process.execPath, args: ["--experimental-strip-types", "--no-warnings", "main.ts"] }) },
    python: { run: () => ({ cmd: env("RUNNER_PYTHON", isWin ? "python" : "python3"), args: ["main.py"] }) },
    java: {
        compile: () => ({ cmd: env("RUNNER_JAVAC", "javac"), args: ["Main.java"] }),
        run: () => ({ cmd: env("RUNNER_JAVA", "java"), args: ["-cp", ".", "Main"] }),
    },
    c: {
        compile: () => ({ cmd: env("RUNNER_GCC", "gcc"), args: ["-O2", "-std=c11", "main.c", "-o", exe("main"), "-lm"] }),
        run: (dir) => ({ cmd: binary(dir), args: [] }),
    },
    cpp: {
        compile: () => ({ cmd: env("RUNNER_GXX", "g++"), args: ["-O2", "-std=c++17", "main.cpp", "-o", exe("main")] }),
        run: (dir) => ({ cmd: binary(dir), args: [] }),
    },
    go: { run: () => ({ cmd: env("RUNNER_GO", "go"), args: ["run", "main.go"] }) },
    rust: {
        compile: () => ({ cmd: env("RUNNER_RUSTC", "rustc"), args: ["-O", "main.rs", "-o", exe("main")] }),
        run: (dir) => ({ cmd: binary(dir), args: [] }),
    },
    php: { run: () => ({ cmd: env("RUNNER_PHP", "php"), args: ["main.php"] }) },
    ruby: { run: () => ({ cmd: env("RUNNER_RUBY", "ruby"), args: ["main.rb"] }) },
    bash: { run: () => ({ cmd: env("RUNNER_BASH", "bash"), args: ["main.sh"] }) },
    lua: { run: () => ({ cmd: env("RUNNER_LUA", "lua"), args: ["main.lua"] }) },
    r: { run: () => ({ cmd: env("RUNNER_RSCRIPT", "Rscript"), args: ["main.r"] }) },
    swift: { run: () => ({ cmd: env("RUNNER_SWIFT", "swift"), args: ["main.swift"] }) },
    kotlin: {
        compile: () => ({ cmd: env("RUNNER_KOTLINC", "kotlinc"), args: ["Main.kt", "-include-runtime", "-d", "main.jar"] }),
        run: () => ({ cmd: env("RUNNER_JAVA", "java"), args: ["-jar", "main.jar"] }),
    },
    csharp: {
        compile: () => ({ cmd: env("RUNNER_MCS", "mcs"), args: ["-out:main.exe", "Main.cs"] }),
        run: (dir) => (isWin ? { cmd: path.join(dir, "main.exe"), args: [] } : { cmd: env("RUNNER_MONO", "mono"), args: ["main.exe"] }),
    },
    sql: { run: () => ({ cmd: env("RUNNER_SQLITE", "sqlite3"), args: [":memory:", ".read main.sql"] }) },
};

const LANGUAGES = Object.fromEntries(CATALOGUE.map((l) => [l.id, {
    label: `${l.label} (${l.runtime})`,
    judge0Id: l.judge0Id,
    file: l.file,
    ...(LOCAL[l.id] || {}),
}]));

const ALIASES = Object.fromEntries(CATALOGUE.flatMap((l) => l.ext.map((e) => [e, l.id])));
Object.assign(ALIASES, { node: "javascript", python3: "python", "c++": "cpp", "c#": "csharp", cs: "csharp", sh: "bash", shell: "bash", golang: "go" });

const resolveLanguage = (name) => {
    const key = String(name || "").toLowerCase();
    return LANGUAGES[key] ? key : ALIASES[key] || null;
};

module.exports = { LANGUAGES, resolveLanguage };
