// Terminal window UI. Talks to terminal.js through window.term (terminal-preload.js).
(() => {
    const $ = (id) => document.getElementById(id);
    const screen = $("screen");
    const input = $("input");
    const promptEl = $("prompt");
    const cwdEl = $("cwd");
    const stateEl = $("state");
    const stopBtn = $("stop");
    const MAX_NODES = 4000;

    let cwd = "";
    let home = "";
    let running = false;
    const history = [];
    let histIdx = 0;

    const short = (dir) => (home && dir.startsWith(home) ? "~" + dir.slice(home.length) : dir);
    const base = (dir) => dir.split(/[\\/]/).filter(Boolean).pop() || dir;

    function setRunning(on) {
        running = on;
        document.body.classList.toggle("running", on);
        stopBtn.disabled = !on;
        stateEl.textContent = on ? "running…" : "";
        promptEl.textContent = on ? "›" : `${base(cwd)} $`;
        input.placeholder = on ? "input for the running program" : "";
    }

    function trim() {
        while (screen.childNodes.length > MAX_NODES) screen.removeChild(screen.firstChild);
    }
    const atBottom = () => screen.scrollHeight - screen.scrollTop - screen.clientHeight < 40;

    function append(node) {
        const stick = atBottom();
        screen.appendChild(node);
        trim();
        if (stick) screen.scrollTop = screen.scrollHeight;
    }

    function line(text, cls) {
        const el = document.createElement("div");
        if (cls) el.className = cls;
        el.textContent = text;
        append(el);
    }

    // Minimal ANSI SGR support: 30-37 / 90-97 colours, bold, reset. Other escapes are dropped.
    let sgr = { color: null, bold: false };
    function ansi(text, stream) {
        const frag = document.createDocumentFragment();
        const re = /\x1b\[([0-9;]*)([A-Za-z])/g;
        let last = 0;
        let m;
        const push = (chunk) => {
            if (!chunk) return;
            const span = document.createElement("span");
            span.textContent = chunk.replace(/\r(?!\n)/g, "");
            if (stream === "stderr" && !sgr.color) span.className = "stderr";
            if (sgr.color) span.style.color = `var(--c${sgr.color})`;
            if (sgr.bold) span.style.fontWeight = "600";
            frag.appendChild(span);
        };
        while ((m = re.exec(text))) {
            push(text.slice(last, m.index));
            last = re.lastIndex;
            if (m[2] !== "m") continue;
            for (const code of (m[1] || "0").split(";").map(Number)) {
                if (code === 0) sgr = { color: null, bold: false };
                else if (code === 1) sgr.bold = true;
                else if (code === 22) sgr.bold = false;
                else if (code === 39) sgr.color = null;
                else if (code >= 30 && code <= 37) sgr.color = code - 30;
                else if (code >= 90 && code <= 97) sgr.color = code - 90;
            }
        }
        // Strip any other escape sequences (OSC titles etc.).
        push(text.slice(last).replace(/\x1b\][^\x07]*\x07|\x1b[^[]/g, ""));
        const stick = atBottom();
        screen.appendChild(frag);
        trim();
        if (stick) screen.scrollTop = screen.scrollHeight;
    }

    function submit() {
        const value = input.value;
        input.value = "";
        if (running) {
            line(value, "cmd");
            window.term.input(value + "\n");
            return;
        }
        const el = document.createElement("div");
        el.className = "cmd";
        const p = document.createElement("span");
        p.className = "p";
        p.textContent = `${base(cwd)} $ `;
        el.append(p, document.createTextNode(value));
        append(el);
        screen.scrollTop = screen.scrollHeight;
        if (value.trim()) {
            if (history[history.length - 1] !== value) history.push(value);
            if (history.length > 200) history.shift();
        }
        histIdx = history.length;
        sgr = { color: null, bold: false };
        setRunning(true);
        window.term.run(value);
    }

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            submit();
        } else if (e.key === "c" && e.ctrlKey && running && !String(window.getSelection())) {
            e.preventDefault();
            window.term.interrupt();
            line("^C", "note");
        } else if (e.key === "l" && e.ctrlKey) {
            e.preventDefault();
            screen.textContent = "";
        } else if (e.key === "ArrowUp" && !running && history.length) {
            e.preventDefault();
            histIdx = Math.max(0, histIdx - 1);
            input.value = history[histIdx];
        } else if (e.key === "ArrowDown" && !running) {
            e.preventDefault();
            histIdx = Math.min(history.length, histIdx + 1);
            input.value = history[histIdx] || "";
        }
    });
    document.addEventListener("mouseup", () => {
        if (!String(window.getSelection())) input.focus();
    });
    stopBtn.addEventListener("click", () => window.term.interrupt());
    $("clear").addEventListener("click", () => {
        screen.textContent = "";
        input.focus();
    });

    window.term.onData(({ stream, text }) => ansi(text, stream));
    window.term.onExit(({ code, cwd: next }) => {
        cwd = next;
        cwdEl.textContent = short(cwd);
        cwdEl.title = cwd;
        document.title = `Terminal — ${base(cwd)}`;
        if (code) line(`exit ${code}`, "exit-bad");
        setRunning(false);
        input.focus();
    });
    window.term.onClear(({ cwd: next }) => {
        cwd = next;
        screen.textContent = "";
        setRunning(false);
    });

    window.term.init().then((info) => {
        cwd = info.cwd;
        home = info.home;
        cwdEl.textContent = short(cwd);
        cwdEl.title = cwd;
        document.title = `Terminal — ${base(cwd)}`;
        line(`${info.shell} on ${info.platform}. Each line runs in ${info.shell}; cd, clear and exit are built in. Ctrl+C stops a program.`, "note");
        setRunning(false);
        input.focus();
    });
})();
