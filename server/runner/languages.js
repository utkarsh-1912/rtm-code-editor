// Languages the runner accepts. Judge0 ids match Judge0 CE; local commands are used
// when no Judge0 instance is reachable. Keep this module free of DB/network imports.
const isWin = process.platform === "win32";
const exe = (name) => (isWin ? `${name}.exe` : name);

const LANGUAGES = {
    javascript: {
        label: "JavaScript (Node.js)",
        judge0Id: 63,
        file: "main.js",
        run: () => ({ cmd: process.execPath, args: ["main.js"] }),
    },
    python: {
        label: "Python 3",
        judge0Id: 71,
        file: "main.py",
        run: () => ({ cmd: process.env.RUNNER_PYTHON || (isWin ? "python" : "python3"), args: ["main.py"] }),
    },
    cpp: {
        label: "C++ (GCC)",
        judge0Id: 54,
        file: "main.cpp",
        compile: () => ({ cmd: process.env.RUNNER_GXX || "g++", args: ["-O2", "-std=c++17", "main.cpp", "-o", exe("main")] }),
        run: (dir) => ({ cmd: require("path").join(dir, exe("main")), args: [] }),
    },
    java: {
        label: "Java",
        judge0Id: 62,
        file: "Main.java",
        compile: () => ({ cmd: process.env.RUNNER_JAVAC || "javac", args: ["Main.java"] }),
        run: () => ({ cmd: process.env.RUNNER_JAVA || "java", args: ["-cp", ".", "Main"] }),
    },
};

const ALIASES = { js: "javascript", node: "javascript", py: "python", python3: "python", "c++": "cpp", cc: "cpp", h: "cpp" };

const resolveLanguage = (name) => {
    const key = String(name || "").toLowerCase();
    return LANGUAGES[key] ? key : ALIASES[key] || null;
};

module.exports = { LANGUAGES, resolveLanguage };
