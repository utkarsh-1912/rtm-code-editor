import { getBackendUrl } from "./api";
import { desktop } from "./runner";

const TASKS = {
    explain: {
        title: "Explanation",
        ask: "Explain what this code does, step by step, in plain language. Point out any bugs or risky spots. Do not rewrite the code.",
        codeKey: null,
    },
    refactor: {
        title: "Refactor",
        ask: "Refactor this code for readability and performance without changing its behaviour. Reply with one short paragraph on what changed, then the full refactored code in a single fenced code block.",
        codeKey: "refactoredCode",
    },
    fix: {
        title: "Audit & fix",
        ask: "Find bugs, edge cases and security problems in this code. List them briefly, then give the full corrected code in a single fenced code block.",
        codeKey: "fixedCode",
    },
    test: {
        title: "Tests",
        ask: "Write focused unit tests for this code using the usual test framework for the language. One sentence on what is covered, then the tests in a single fenced code block.",
        codeKey: "testCode",
    },
    prompt: {
        title: "Answer",
        ask: null,
        codeKey: "generatedCode",
    },
};

const SYSTEM = "You are a concise senior engineer pairing inside a collaborative code editor. Answer in English. Keep prose short. When you return code, return complete runnable code in exactly one fenced code block.";

export function buildMessages({ action, code, language, prompt }) {
    const task = TASKS[action] || TASKS.prompt;
    const request = action === "prompt" ? prompt : task.ask;
    const clipped = (code || "").slice(0, 12000);
    return [
        { role: "system", content: SYSTEM },
        { role: "user", content: `${request}\n\nLanguage: ${language}\n\n\`\`\`${language}\n${clipped}\n\`\`\`` },
    ];
}

// Split a model reply into prose + the first fenced code block.
export function parseReply(action, text, meta = {}) {
    const task = TASKS[action] || TASKS.prompt;
    const match = /```[\w+#.-]*\n([\s\S]*?)```/.exec(text || "");
    const prose = (match ? text.replace(match[0], "") : text || "").trim();
    const result = { title: task.title, explanation: prose };
    if (match && task.codeKey) result[task.codeKey] = match[1].replace(/\n$/, "");
    if (meta.model) result.summary = `${meta.model}${meta.where ? ` · ${meta.where}` : ""}${meta.ms ? ` · ${(meta.ms / 1000).toFixed(1)}s` : ""}`;
    return result;
}

/**
 * Ask the copilot. Installed app: local model via the desktop bridge (Ollama on this
 * machine) first, then the server. Browser: the server, which talks to its own model.
 */
export async function askCopilot({ action, code, language, prompt, roomId, projectId, userId }) {
    const messages = buildMessages({ action, code, language, prompt });
    const started = performance.now();

    const bridge = desktop();
    if (bridge?.llmLocal) {
        try {
            const local = await bridge.llmLocal({ messages });
            if (local?.text) return parseReply(action, local.text, { model: local.model, where: "on this device", ms: performance.now() - started });
        } catch (err) {
            /* no local model running: use the server */
        }
    }

    const res = await fetch(`${getBackendUrl()}/api/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, messages, language, roomId, projectId, userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || `Copilot responded ${res.status}`);
    return parseReply(action, data.text, { model: data.model, where: "server", ms: performance.now() - started });
}
