// Runs one program with a runtime bundled in the app, so it works on any computer with no
// installs and no internet: TypeScript (sucrase), Python (Pyodide), SQL (sql.js), Lua (fengari).
// runner.js starts this in its own Node process (the app's Node, ELECTRON_RUN_AS_NODE=1), so the
// time limit can always stop it.
//
// usage: node sandbox.js <language> <file>   (in the run folder; stdin = the program's input)
const fs = require("fs");
const path = require("path");

const [, , language, file] = process.argv;
const readStdin = () => {
    try { return fs.readFileSync(0, "utf8"); } catch { return ""; }
};
// Packaged app: big runtime files live outside the asar archive.
const unpacked = (p) => p.replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
const fail = (msg) => { process.stderr.write(String(msg).replace(/\s*$/, "\n")); process.exitCode = 1; };

async function typescript() {
    const { transform } = require("sucrase");
    const src = fs.readFileSync(file, "utf8");
    const js = transform(src, { transforms: ["typescript", "imports"], filePath: file }).code;
    const out = path.resolve("main.compiled.js");
    fs.writeFileSync(out, js);
    require(out);
}

async function python() {
    const { loadPyodide } = require("pyodide");
    const indexURL = unpacked(path.dirname(require.resolve("pyodide/package.json"))) + path.sep;
    const py = await loadPyodide({ indexURL, stdout: (s) => process.stdout.write(s + "\n"), stderr: (s) => process.stderr.write(s + "\n") });
    const lines = readStdin().split(/\r?\n/);
    let i = 0;
    py.setStdin({ stdin: () => (i < lines.length ? lines[i++] : undefined) });
    try {
        await py.runPythonAsync(fs.readFileSync(file, "utf8"), { filename: "main.py" });
    } catch (err) {
        // Pyodide's message is the Python traceback; keep just the user's part.
        const text = String(err.message || err);
        const at = text.indexOf('File "main.py"');
        fail(at > 0 ? `Traceback (most recent call last):\n  ${text.slice(at)}` : text);
    }
}

async function sql() {
    const initSqlJs = require("sql.js");
    const dist = unpacked(path.dirname(require.resolve("sql.js/dist/sql-wasm.js")));
    const SQL = await initSqlJs({ locateFile: (f) => path.join(dist, f) });
    const db = new SQL.Database();
    // Like the sqlite3 shell: dot-commands between statements (.headers, .mode).
    let headers = false;
    let mode = "list";
    const show = (v) => (v === null || v === undefined ? "" : v instanceof Uint8Array ? `<blob ${v.length}>` : String(v));
    const print = (res) => {
        for (const { columns, values } of res) {
            const rows = values.map((r) => r.map(show));
            if (mode === "column" || mode === "table" || mode === "box") {
                const w = columns.map((c, i) => Math.max(c.length, ...rows.map((r) => r[i].length)));
                const line = (cells) => cells.map((c, i) => c.padEnd(w[i])).join("  ").replace(/\s+$/, "");
                if (headers) {
                    process.stdout.write(line(columns) + "\n");
                    process.stdout.write(w.map((n) => "-".repeat(n)).join("  ") + "\n");
                }
                rows.forEach((r) => process.stdout.write(line(r) + "\n"));
            } else {
                const sep = mode === "csv" ? "," : mode === "tabs" ? "\t" : "|";
                const cell = (c) => (mode === "csv" && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
                if (headers) process.stdout.write(columns.map(cell).join(sep) + "\n");
                rows.forEach((r) => process.stdout.write(r.map(cell).join(sep) + "\n"));
            }
        }
    };
    let chunk = "";
    const flush = () => {
        if (!chunk.trim()) { chunk = ""; return true; }
        try {
            print(db.exec(chunk));
            chunk = "";
            return true;
        } catch (err) {
            fail(`Error: ${err.message}`);
            return false;
        }
    };
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const line = raw.trim();
        if (line.startsWith(".") && !chunk.trim()) {
            const [cmd, arg] = line.split(/\s+/);
            if (cmd === ".headers") headers = arg === "on";
            else if (cmd === ".mode") mode = arg || "list";
            continue; // other dot-commands are ignored
        }
        chunk += raw + "\n";
    }
    flush();
}

async function lua() {
    const { lua: L, lauxlib, lualib, to_luastring, to_jsstring } = require("fengari");
    const state = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(state);
    // io.read over this run's input (fengari has no stdin of its own).
    L.lua_pushstring(state, to_luastring(readStdin()));
    L.lua_setglobal(state, to_luastring("__STDIN"));
    const prelude = `
local __buf, __pos = __STDIN or "", 1
__STDIN = nil
io.read = function(fmt)
  fmt = fmt or "l"
  if type(fmt) == "string" then fmt = fmt:gsub("^%*", "") end
  if __pos > #__buf then return nil end
  if fmt == "a" then local s = __buf:sub(__pos); __pos = #__buf + 1; return s end
  if fmt == "n" then
    local s, e = __buf:find("^%s*[-+]?%d+%.?%d*[eE]?[-+]?%d*", __pos)
    if not s then return nil end
    __pos = e + 1
    return tonumber(__buf:sub(s, e))
  end
  local nl = __buf:find("\\n", __pos, true)
  local line = __buf:sub(__pos, (nl or #__buf + 1) - 1)
  __pos = (nl or #__buf) + 1
  if fmt == "L" and nl then return line .. "\\n" end
  return (line:gsub("\\r$", ""))
end
io.lines = function() return function() return io.read("l") end end
`;
    const run = (code, name) => {
        if (lauxlib.luaL_loadbuffer(state, to_luastring(code), null, to_luastring(name)) !== L.LUA_OK || L.lua_pcall(state, 0, 0, 0) !== L.LUA_OK) {
            fail(`lua: ${to_jsstring(L.lua_tostring(state, -1))}`);
            return false;
        }
        return true;
    };
    if (run(prelude, "=prelude")) run(fs.readFileSync(file, "utf8"), "@main.lua");
}

const RUNTIMES = { typescript, python, sql, lua };
(async () => {
    const fn = RUNTIMES[language];
    if (!fn) return fail(`No bundled runtime for ${language}`);
    try {
        await fn();
    } catch (err) {
        fail(err && err.stack ? err.stack.split("\n").slice(0, 6).join("\n") : String(err));
    }
})();
