# Utkristi CoLabs

Real-time pair programming in the browser and on the desktop. Rooms for quick sessions, projects that stick around, and snippets you can reuse, with voice, video, a whiteboard, chat, a code runner and an AI copilot in the same window.

**Web:** https://utkristi-colabs.onrender.com · **Desktop:** Windows, macOS and Linux installers on the [releases page](https://github.com/utkarsh-1912/rtm-code-editor/releases)

---

## What it does

| Area | Features |
| --- | --- |
| Rooms | One-click private rooms with a shareable link, guests join with just a name, spectator (read-only) links, live cursors, room chat |
| Projects | Multi-file workspace with a file tree and tabs. Web projects get a live preview + console; C++, Python and Java projects get stdin + output. Invite teammates by email |
| Running code | JavaScript, Python, C++ and Java through the code runner (Judge0 or local processes), output shared with everyone in the room |
| Collaboration | Peer-to-peer voice and video, screen sharing with annotations, a shared whiteboard |
| History | Save named snapshots, compare them line by line with the current code, restore any version |
| AI copilot | Explain, refactor, audit & fix, write tests, or ask anything. Runs on an open-weight model you host (default: Qwen2.5-Coder via Ollama) |
| Library | Personal and team snippet vaults, insert a snippet into any room, export code to a GitHub gist |
| Everywhere | Command palette (Ctrl K), focus mode (Alt F), Vim/Emacs keybindings, dark/light/system themes |

## Architecture

```
 browser / desktop app ──► API server (Express + Socket.IO) ──► Postgres (Neon)
          │                      │
          │                      ├─ /api/run ──► code runner ──► Judge0 (self-hosted or hosted)
          │                      │                         └──► local processes (dev only)
          │                      └─ /api/copilot ──► OpenAI-compatible model (Ollama, llama.cpp, LM Studio, vLLM)
          │
          └─ desktop only, tried first: local Judge0 (:2358) and local Ollama (:11434)
```

- **The code runner has no database dependency.** It lives in [`server/runner/`](server/runner) and is mounted at `/api/run` in the API server, or run on its own with `npm run runner`.
- **The API server starts before the database.** It listens immediately, so health checks, the runner and sockets work during a cold start. The schema initialises in the background with retries, and `/api/ping` reports `db: starting | ready | error`.
- **Rooms don't wait on the database.** People are joined and synced over sockets first; persistence happens afterwards.
- **Cold starts are visible.** Free hosting sleeps when idle. The web app shows a "Waking the server" notice with a timer, and the desktop app shows a splash until the server answers.

## Run it locally

Requirements: Node.js 18+ (20 recommended). Optional: Docker (for Judge0) and [Ollama](https://ollama.com) (for the AI copilot).

```bash
git clone https://github.com/utkarsh-1912/rtm-code-editor.git
cd rtm-code-editor
npm install
```

Create a `.env` in the project root:

```env
# Database + email
DATABASE_URL=postgres://…            # Neon or any Postgres
BREVO_API_KEY=…                      # optional, for invite / support emails
BREVO_FROM_EMAIL=noreply@yourdomain.com
ONESIGNAL_APP_ID=…                   # optional: push + email fallback
ONESIGNAL_REST_API_KEY=…
REACT_APP_ONESIGNAL_APP_ID=…         # same app id, for the web build
SUPPORT_EMAIL=you@yourdomain.com
APP_URL=http://localhost:3000

# Web app
REACT_APP_BACKEND_URL=http://localhost:5000
# REACT_APP_RUNNER_URL=http://localhost:5050/api   # only if the runner runs as its own service
REACT_APP_FIREBASE_API_KEY=…
REACT_APP_FIREBASE_AUTH_DOMAIN=…
REACT_APP_FIREBASE_PROJECT_ID=…
REACT_APP_FIREBASE_STORAGE_BUCKET=…
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=…
REACT_APP_FIREBASE_APP_ID=…

# Code runner (server side only, never REACT_APP_*)
JUDGE0_URL=http://localhost:2358     # self-hosted Judge0 CE
# JUDGE0_AUTH_TOKEN=…                # if your Judge0 requires one
# JUDGE0_RAPIDAPI_KEY=…              # hosted Judge0 instead of self-hosting
# RUNNER_ENGINES=judge0,local        # order to try; "local" runs processes on the server
# RUNNER_LOCAL=1                     # allow the local engine in production (unsandboxed!)

# AI copilot (any OpenAI-compatible endpoint)
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5-coder:1.5b
# LLM_API_KEY=…
```

Then, in two terminals:

```bash
npm run server:dev      # API server on :5000
npm run start:front     # web app on :3000
```

### Code runner

The runner tries engines in `RUNNER_ENGINES` order and returns the first result:

1. **Judge0**, set by `JUDGE0_URL` (self-hosted, recommended) or `JUDGE0_RAPIDAPI_KEY` (hosted). Judge0 is open source and runs each submission in an isolated sandbox. Follow the [Judge0 deployment guide](https://github.com/judge0/judge0/blob/master/CHANGELOG.md#deployment-procedure): download the release, then `docker compose up -d db redis`, wait a few seconds, and run `docker compose up -d`.
2. **Local processes** run `node`, `python`, `g++` and `javac` in a temp folder with a time limit and an output cap. They are on by default in development and off in production unless `RUNNER_LOCAL=1`. This engine is **not** a sandbox, so only use it on a machine or container you are happy to run untrusted code on.

To run the runner as a separate service:

```bash
npm run runner          # listens on RUNNER_PORT (default 5050)
# and point the web app at it:
REACT_APP_RUNNER_URL=http://localhost:5050/api
```

API: `POST /api/run` with `{ "language": "python", "source": "print(1)", "stdin": "" }` returns `{ ok, stdout, stderr, compileOutput, status, timeMs, engine }`. `GET /api/runner` lists the enabled engines and languages.

### AI copilot

The client builds the prompt and the server forwards it to `LLM_BASE_URL`, so any OpenAI-compatible server works. Small open-weight code models are a good fit:

| Model | Size | Good for |
| --- | --- | --- |
| `qwen2.5-coder:1.5b` (default) | ~1 GB | Laptops and CPU-only servers |
| `qwen2.5-coder:7b` | ~4.7 GB | Better answers with 8 GB of free memory |
| `qwen3-coder:30b` | MoE, ~3B active | Workstations with a 24 GB GPU |

```bash
ollama pull qwen2.5-coder:1.5b
ollama serve
```

To use a fine-tuned model, load your GGUF into Ollama with a `Modelfile` (`FROM ./my-model.gguf`), `ollama create my-coder -f Modelfile`, and set `LLM_MODEL=my-coder`.

## Desktop apps

The [`desktop/`](desktop) folder is an Electron shell around the web app for Windows, macOS and Linux:

- It shows a splash screen until the server is awake, then opens the app.
- It runs code on a **local Judge0** (`http://localhost:2358`) first and only uses the server if that fails.
- It sends copilot requests to a **local model** (`http://localhost:11434/v1`, `qwen2.5-coder:1.5b`) first, then the server.
- Sign-in popups stay in the app, and other links open in your browser.
- **Open Folder / Open Files** (File menu, `Ctrl+Shift+O` / `Ctrl+O`, or the dashboard buttons) turn a folder on disk into a project, VS Code style. It skips `.git`, `node_modules`, build output and binary files, and imports at most 500 text files (1 MB each, 20 MB in total). The project type is `web` if there's an `index.html`, otherwise the most common language. In a project, **Save to disk** writes the files back to that folder, and **Add files from disk** adds more. The web app can do the same imports in a browser but can't save back.
- **Terminal** (`` Ctrl+` `` or the project header) opens a separate terminal window in the project's folder. Each line runs in your shell (`cmd.exe` on Windows, `$SHELL` elsewhere, or `COLABS_SHELL`). `cd`, `clear` and `exit` are built in, typing while a program runs goes to its stdin, and `Ctrl+C` stops it. It's line-based rather than a full PTY, so full-screen programs like `vim` won't work.
- The web page never gets raw file access. It can only read what you pick in a native dialog, write inside folders you picked, and open a terminal; commands can only be typed in the terminal window itself.

Override the defaults with `COLABS_APP_URL`, `COLABS_JUDGE0_URL`, `COLABS_LLM_URL`, `COLABS_LLM_MODEL` and `COLABS_SHELL`.

```bash
cd desktop
npm install
npm start                 # run against the hosted app
npm start -- --url=http://localhost:3000   # run against your local dev server
npm run dist              # build installers for the current OS into desktop/dist
```

**Releases:** `npm run release -- 1.2.0` bumps the web and desktop versions, commits and tags `v1.2.0`; `git push --follow-tags` then runs [`.github/workflows/release.yml`](.github/workflows/release.yml): it checks the server and builds the web app, builds `Utkristi-CoLabs-win-x64.exe`, `Utkristi-CoLabs-mac-universal.dmg`, `Utkristi-CoLabs-linux-x64.AppImage` and `.deb`, publishes one GitHub release with `SHA256SUMS.txt`, and (if the `RENDER_DEPLOY_HOOK` secret is set) redeploys the site. The [download page](https://utkristi-colabs.onrender.com/download) reads the latest release through `/api/release/latest` (cached, with a direct GitHub fallback) and links to the right file for your OS. Builds are unsigned until signing certificates are added as repository secrets, so SmartScreen and Gatekeeper ask once before the first launch.

**Notifications and email fallback:** set `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` (server) plus `REACT_APP_ONESIGNAL_APP_ID` (web build) to enable push. Users are linked by their Firebase uid, and Settings > Notifications has the opt-in switch and a test button. The installed desktop app shows native notifications instead. Email goes Brevo first, then OneSignal email (`ONESIGNAL_FROM_EMAIL`, `ONESIGNAL_FROM_NAME`; the sender domain must be verified in OneSignal), then Resend if `RESEND_API_KEY` is set.

## Deploying

- **API + web:** `npm run build` then `NODE_ENV=production node server.js`. In production the server also serves the React build. Render, Railway and Fly all work, and so does any Node host.
- **Database:** any Postgres. The schema is created automatically on start, and `npm run setup-db` creates it on demand.
- **Code runner:** point `JUDGE0_URL` at a Judge0 instance, or deploy `npm run runner` separately next to it.
- **AI:** point `LLM_BASE_URL` at your model server. Without one, the copilot says no model is reachable instead of failing silently.

## Project layout

```
server.js                 API server entry (Express + Socket.IO)
server/runner/            code runner (no DB): engines, router, standalone service
server/routes/            REST routes (projects, snippets, AI, snapshots, …)
server/sockets/           real-time rooms, whiteboard and media signalling
server/repositories/      Postgres access
src/                      React app (pages, components, styles/app.css design system)
desktop/                  Electron app for Windows, macOS and Linux
.github/workflows/        desktop release pipeline
```

---

Built by [Utkristi.io](https://utkristi-io.netlify.app).
