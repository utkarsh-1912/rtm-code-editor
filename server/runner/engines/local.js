// Local process engine: compiles/runs in a throwaway temp dir with a time limit and
// an output cap. It does NOT sandbox the code, so only enable it (RUNNER_LOCAL=1) on a
// machine or container you are happy to run untrusted code on.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const MAX_OUTPUT = 64 * 1024;

const available = () => process.env.RUNNER_LOCAL === "1" || (process.env.RUNNER_LOCAL !== "0" && process.env.NODE_ENV !== "production");

function exec({ cmd, args }, { cwd, stdin, timeoutMs }) {
    return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        let killed = false;
        let child;
        try {
            child = spawn(cmd, args, { cwd, windowsHide: true, env: { PATH: process.env.PATH, HOME: cwd, TMP: cwd, TEMP: cwd, SystemRoot: process.env.SystemRoot } });
        } catch (err) {
            return resolve({ code: -1, stdout, stderr: err.message, killed });
        }
        const timer = setTimeout(() => { killed = true; child.kill("SIGKILL"); }, timeoutMs);
        const cap = (buf, add) => (buf.length > MAX_OUTPUT ? buf : (buf + add).slice(0, MAX_OUTPUT));
        child.stdout.on("data", (d) => { stdout = cap(stdout, d.toString()); });
        child.stderr.on("data", (d) => { stderr = cap(stderr, d.toString()); });
        child.on("error", (err) => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: err.code === "ENOENT" ? `${cmd} is not installed on the runner` : err.message, killed }); });
        child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, killed }); });
        if (stdin) child.stdin.write(stdin);
        child.stdin.end();
    });
}

async function run({ spec, source, stdin, timeoutMs }) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "colabs-run-"));
    const started = Date.now();
    try {
        fs.writeFileSync(path.join(dir, spec.file), source);
        if (spec.compile) {
            const c = await exec(spec.compile(dir), { cwd: dir, stdin: "", timeoutMs: timeoutMs * 2 });
            if (c.code !== 0) {
                return { ok: false, stdout: "", stderr: "", compileOutput: c.stderr || c.stdout, status: c.killed ? "Compilation timed out" : "Compilation Error", exitCode: c.code, timeMs: Date.now() - started, engine: "local" };
            }
        }
        const r = await exec(spec.run(dir), { cwd: dir, stdin, timeoutMs });
        return {
            ok: r.code === 0 && !r.killed,
            stdout: r.stdout,
            stderr: r.stderr,
            compileOutput: "",
            status: r.killed ? "Time Limit Exceeded" : r.code === 0 ? "Accepted" : "Runtime Error",
            exitCode: r.code,
            timeMs: Date.now() - started,
            engine: "local",
        };
    } finally {
        fs.rm(dir, { recursive: true, force: true }, () => {});
    }
}

module.exports = { name: "local", available, run };
