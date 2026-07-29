const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Executes a code snippet in a sandboxed temporary directory
 */
async function executeCode(language, code, input = "") {
    return new Promise((resolve) => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rtm-exec-"));
        let command = "";
        let args = [];
        let filePath = "";

        if (language === "javascript" || language === "js") {
            filePath = path.join(tmpDir, "script.js");
            fs.writeFileSync(filePath, code);
            command = "node";
            args = [filePath];
        } else if (language === "python" || language === "py") {
            filePath = path.join(tmpDir, "main.py");
            fs.writeFileSync(filePath, code);
            command = "python3";
            args = [filePath];
        } else if (language === "cpp" || language === "c++") {
            filePath = path.join(tmpDir, "main.cpp");
            const binPath = path.join(tmpDir, "main.out");
            fs.writeFileSync(filePath, code);
            command = "sh";
            args = ["-c", `g++ "${filePath}" -o "${binPath}" && "${binPath}"`];
        } else {
            cleanup(tmpDir);
            return resolve({ success: false, output: `Unsupported runtime: ${language}` });
        }

        const child = spawn(command, args, { timeout: 10000 });
        let output = "";
        let errorOutput = "";

        if (input && child.stdin) {
            child.stdin.write(input);
            child.stdin.end();
        }

        child.stdout.on("data", (data) => {
            output += data.toString();
        });

        child.stderr.on("data", (data) => {
            errorOutput += data.toString();
        });

        child.on("close", (code) => {
            cleanup(tmpDir);
            if (code === 0) {
                resolve({ success: true, output: output || "Program finished with 0 errors." });
            } else {
                resolve({ success: false, output: errorOutput || output || `Process exited with code ${code}` });
            }
        });

        child.on("error", (err) => {
            cleanup(tmpDir);
            resolve({ success: false, output: err.message });
        });
    });
}

function cleanup(dirPath) {
    try {
        fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (e) { }
}

module.exports = {
    executeCode
};
