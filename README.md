# Utkristi CoLabs

Real-time pair programming in the browser and on the desktop. Rooms for quick sessions, projects that stick around, and snippets you can reuse, with voice, video, a whiteboard, chat, a code runner and an AI copilot in the same window.

**Web:** https://utkristi-colabs.onrender.com · **Desktop:** Windows, macOS and Linux installers on the [releases page](https://github.com/utkarsh-1912/rtm-code-editor/releases)

---

## What it does

| Area | Features |
| --- | --- |
| Rooms | One-click rooms with a shareable link, guests join with just a name, spectator (read-only) links, live cursors, room chat. Open, ask-to-join or invited-only access |
| Projects | Multi-file workspace with a file tree and tabs, card or classic layouts. Web projects get a live preview + console; other languages get stdin + output. Private to the owner, invitees and holders of the project's share link |
| Running code | 17 languages through the code runner (Judge0, or local processes in development); the desktop app runs them all on your computer, offline |
| Calls | Peer-to-peer voice and video, screen sharing with the presenter's camera beside it, shared pointers and drawing, a "call started" prompt for the room, camera/mic check before joining |
| Meetings | Scheduled calls in any time zone: email with a calendar invite attached, Yes / No replies, reminders, edit and reschedule (calendars update). Organisers get the guest list, private notes, code snapshots with line-by-line changes and comments, co-organisers, and End meeting (guests lose access; auto-ends an hour after running over) |
| Whiteboard | Freehand drawing and system-design diagrams with labelled connectors, live for everyone |
| History | Save named snapshots, compare them line by line with the current code, restore any version |
| AI copilot | Explain, refactor, audit & fix, write tests, or ask anything. Choose the default model: the hosted one, models the site provides (some by request), or your own key for Gemini, Claude Sonnet/Haiku, OpenAI, OpenRouter, Grok, Qwen, Kimi, Sarvam or any OpenAI-compatible server |
| Library | Personal and team snippet vaults, insert a snippet into any room, export code to a GitHub gist |
| Everywhere | Search (Ctrl K), help (?), focus mode (Alt F), Vim/Emacs keybindings, dark/light/system themes |

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
STRIPE_SECRET_KEY=sk_…               # optional: paid plans
STRIPE_WEBHOOK_SECRET=whsec_…
ONESIGNAL_APP_ID=…                   # optional: push + email fallback
ONESIGNAL_REST_API_KEY=…
REACT_APP_ONESIGNAL_APP_ID=…         # same app id, for the web build
SUPPORT_EMAIL=you@yourdomain.com
APP_URL=http://localhost:3000

# GitHub integration (optional; see docs/GITHUB_INTEGRATION.md)
GITHUB_CLIENT_ID=…                   # GitHub OAuth app
GITHUB_CLIENT_SECRET=…
GITHUB_TOKEN_ENCRYPTION_KEY=…        # any long random string: openssl rand -base64 32
# GITHUB_CALLBACK_URL=http://localhost:5000/api/github/callback   # defaults to <this server>/api/github/callback

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

# AI copilot: Google Gemini (key stays on the server)
GEMINI_API_KEY=…
# GEMINI_MODEL=gemini-3.6-flash
# Self-hosted model instead (wins over Gemini when set): any OpenAI-compatible server
# LLM_BASE_URL=http://localhost:11434/v1
# LLM_MODEL=qwen2.5-coder:1.5b
# LLM_API_KEY=…

# Models you provide to users (Settings › AI models, Features page "Request access")
# ANTHROPIC_API_KEY=…                # also: OPENAI_, OPENROUTER_, XAI_, QWEN_, KIMI_, SARVAM_API_KEY
# PLATFORM_MODELS='[{"id":"sonnet","label":"Claude Sonnet 5.5","provider":"anthropic","model":"claude-sonnet-5-5","access":"request"}]'
ADMIN_EMAILS=you@yourdomain.com      # who approves model access requests (comma-separated)

# Meetings
# RSVP_SECRET=…                      # signs the Yes/No links in invite emails (default: derived from DATABASE_URL)
# MEETING_EMAILS_PER_DAY=100         # per-account cap on meeting emails
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

The client builds the prompt and the server forwards it to the model. The website uses **Google Gemini** (`gemini-3.6-flash` by default) with `GEMINI_API_KEY`, which stays on the server and never reaches the browser. Get a key from Google AI Studio.

The desktop app runs a local model on your machine first (Ollama), then falls back to the server. To self-host the server's model instead of Gemini, set `LLM_BASE_URL` to any OpenAI-compatible server. Small open-weight code models are a good fit:

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

### Meetings

Schedule from the workspace or inside a room. The meeting page (`/meet/:id`) is the invite link: a camera and mic check, the guest's name carried over from the email, and Join from 10 minutes before the start. Organisers (the host and co-organisers) see the guest list with replies, private notes, and the code snapshots taken in the room during the call (each with its changes since the previous one and a private comment). **End meeting** takes a final snapshot, makes the room private to organisers and sends everyone else out. A background job sends reminders, asks organisers to end meetings that run over, and ends them an hour after their end time.

Invite emails carry an `.ics` invite (`METHOD:REQUEST`, cancellations as `METHOD:CANCEL`) so mail apps add and update the calendar entry themselves, plus signed Yes / No links. Each account can send `MEETING_EMAILS_PER_DAY` meeting emails a day; failed sends don't count.

### AI models and your own keys

`src/shared/aiProviders.js` lists the providers and how to call each one; the browser, the desktop app and the server all use it.

- **Your own key** (Settings › AI models): kept on the device, never on the server. In a browser it's encrypted with AES-256-GCM under a non-extractable WebCrypto key in IndexedDB, optionally under a passphrase (PBKDF2, 600k rounds) that keeps keys locked until unlocked. In the desktop app it's encrypted with Electron `safeStorage` (DPAPI / Keychain) and never returned to the page: the main process adds the key to the request. Every key is bound to the address it was saved for and can't be sent anywhere else.
- **Providers that block browser calls** (Grok, Qwen, Kimi, Sarvam) go through `POST /api/ai/relay`: signed-in, rate-limited, known provider addresses only, the key travels in a header for that one request and is never stored or logged.
- **Platform models** come from `PLATFORM_MODELS` (default: hosted Gemini for everyone, Claude Sonnet and Haiku by request when `ANTHROPIC_API_KEY` is set). People request access; `ADMIN_EMAILS` approve in Settings › AI models, and the copilot route enforces it.

### Security model

- `server/security/access.js` verifies the Firebase ID token on every `/api` request. Any `userId` / `uid` in a request must be the signed-in caller, so ids can't be swapped. The web app adds the token to every API request (`src/utils/authFetch.js`).
- Projects open to their owner, people invited by email and holders of the project's random share key (`/project/:id?k=…`). Only the owner renames, deletes or invites. The same rule guards the project's live session and its GitHub routes.
- Rooms are open, ask-to-join or invited-only; private rooms check the verified sign-in before anyone joins, and socket events only count from members.
- Rate limits on the API, support form, invitations and sign-in sync; security headers on every response; generic error messages to callers.
- The local code engine is not a sandbox: keep `RUNNER_LOCAL` unset in production (the server warns at start if it isn't).

## Desktop apps

The [`desktop/`](desktop) folder is an Electron shell around the web app for Windows, macOS and Linux:

- **It opens instantly.** The installers ship a copy of the web UI, served from `http://localhost:47821` inside the app (the next free port up to 47830 if it's taken), so the app doesn't wait for the server to wake up. Data, live sessions and sign-in still go to the hosted server, and the page shows its usual notice while that server starts. The port stays the same between runs so you stay signed in; Firebase allows `localhost` by default. The local server only answers requests addressed to that port, and invite links still point at the public site.
- It's an app, not the website. `/` goes to your workspace, or to a small launcher when you're signed out (sign in, or join or start a room as a guest, plus local Judge0 and AI status). Marketing pages aren't in the app, and help, legal and status links open in your browser. The website footer is replaced by a slim status bar, **Settings › Desktop app** shows what runs locally, and the menus add **Go** (`Ctrl+1/2/3` for Workspace, Snippets and Settings), **File › New Room** (`Ctrl+N`) and **Help**. Menu navigation happens in place, so calls and connections stay up.
- The bundled UI is the version that shipped with the installer, so update the app to get web UI changes. Keep server API changes backward compatible, because installed apps keep using the UI they shipped with. Installers built without a UI bundle open the hosted site and show a splash until it wakes, as does `COLABS_REMOTE_UI=1`, `--url=` or `COLABS_APP_URL`.
- It runs code on a **local Judge0** (`http://localhost:2358`) first and only uses the server if that fails.
- It sends copilot requests to a **local model** (`http://localhost:11434/v1`, `qwen2.5-coder:1.5b`) first, then the server, unless you picked another default model in Settings › AI models.
- It runs all 17 languages on your computer: JavaScript, TypeScript, Python, SQL and Lua are bundled, installed toolchains are detected, and **Settings › Desktop app** installs language packs for the rest. Without internet the workspace shows its last copy and the offline editor (`Ctrl+4`) runs files locally.
- Sign-in popups stay in the app, and other links open in your browser.
- **Open Folder / Open Files** (File menu, `Ctrl+Shift+O` / `Ctrl+O`, or the dashboard buttons) turn a folder on disk into a project, VS Code style. It skips `.git`, `node_modules`, build output and binary files, and imports at most 500 text files (1 MB each, 20 MB in total). The project type is `web` if there's an `index.html`, otherwise the most common language. In a project, **Save to disk** writes the files back to that folder, and **Add files from disk** adds more. The web app can do the same imports in a browser but can't save back.
- **Terminal** (`` Ctrl+` ``, the status bar, or the project's card layout) docks a terminal into the project, running in the project's folder; pop it out into its own window any time. Each line runs in your shell (`cmd.exe` on Windows, `$SHELL` elsewhere, or `COLABS_SHELL`). `cd`, `clear` and `exit` are built in, typing while a program runs goes to its stdin, and `Ctrl+C` stops it. It's line-based rather than a full PTY, so full-screen programs like `vim` won't work.
- The web page never gets raw file access. It can only read what you pick in a native dialog, write inside folders you picked, and open a terminal; commands can only be typed in the terminal window itself.

Override the defaults with `COLABS_APP_URL`, `COLABS_REMOTE_UI`, `COLABS_UI_PORT`, `COLABS_JUDGE0_URL`, `COLABS_LLM_URL`, `COLABS_LLM_MODEL` and `COLABS_SHELL`.

```bash
cd desktop
npm install
npm start                 # bundled UI if desktop/web exists, else the hosted app
npm start -- --url=http://localhost:3000   # run against your local dev server
npm run bundle-web        # copy ../build (from "npm run build" at the root) into desktop/web
npm run dist              # bundle-web + installers for the current OS into desktop/dist
```

**Releases:** `npm run release -- 1.2.0` bumps the web and desktop versions, commits and tags `v1.2.0`; `git push --follow-tags` then runs [`.github/workflows/release.yml`](.github/workflows/release.yml): it checks the server, builds the web app (with the `REACT_APP_FIREBASE_*`, `REACT_APP_TURN_*` and `REACT_APP_RUNNER_URL` repository secrets or variables) and bundles it into the installers, builds `Utkristi-CoLabs-win-x64.exe`, `Utkristi-CoLabs-mac-universal.dmg`, `Utkristi-CoLabs-linux-x64.AppImage` and `.deb`, publishes one GitHub release with `SHA256SUMS.txt`, and (if the `RENDER_DEPLOY_HOOK` secret is set) redeploys the site. The [download page](https://utkristi-colabs.onrender.com/download) reads the latest release through `/api/release/latest` (cached, with a direct GitHub fallback) and links to the right file for your OS. Without the Firebase settings the installers skip the bundled UI and open the hosted site instead. Builds are unsigned until signing certificates are added as repository secrets, so SmartScreen and Gatekeeper ask once before the first launch.

**Plans and billing:** prices and limits live in [`src/shared/plans.json`](src/shared/plans.json), used by both the server and the pricing page. Upgrades use Stripe Checkout (14-day trial), changes and cancellations use the Stripe customer portal, and the webhook is the only thing that writes a user's plan. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on the server, `APP_URL` to the public site URL, and point a Stripe webhook at `/api/billing/webhook` for `checkout.session.completed` and `customer.subscription.created|updated|deleted`. Prices are created inline, so there are no Stripe products to set up. Billing endpoints verify the caller's Firebase ID token with `FIREBASE_API_KEY` (falls back to `REACT_APP_FIREBASE_API_KEY`). Without Stripe keys the app runs normally and checkout answers "Billing is not configured". The go-to-market plan is in [`docs/MARKETING_PLAN.md`](docs/MARKETING_PLAN.md).

**GitHub:** connect a GitHub account in Settings > Connections (an OAuth app with the `repo` and `gist` scopes), then use **GitHub** in a room's or project's ⋯ menu to push files as one commit to a new or existing repository, import a repository folder into a project, keep a project in two-way sync with a branch (changes on each side, pull with a conflict notice, commit and push), or share code as a gist. Tokens are stored encrypted on the server and every GitHub call goes through `/api/github/*`. Setup is in [`docs/GITHUB_INTEGRATION.md`](docs/GITHUB_INTEGRATION.md).

**Notifications and email fallback:** set `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` (server) plus `REACT_APP_ONESIGNAL_APP_ID` (web build) to enable push. Users are linked by their Firebase uid, and Settings > Notifications has the opt-in switch and a test button. The installed desktop app shows native notifications instead. Email goes Brevo first, then OneSignal email (`ONESIGNAL_FROM_EMAIL`, `ONESIGNAL_FROM_NAME`; the sender domain must be verified in OneSignal), then Resend if `RESEND_API_KEY` is set.

## Deploying

- **API + web:** `npm run build` then `NODE_ENV=production node server.js`. In production the server also serves the React build. Render, Railway and Fly all work, and so does any Node host.
- **Database:** any Postgres. The schema is created automatically on start, and `npm run setup-db` creates it on demand.
- **Code runner:** point `JUDGE0_URL` at a Judge0 instance, or deploy `npm run runner` separately next to it.
- **AI:** set `GEMINI_API_KEY` on the API host (or `LLM_BASE_URL` for a self-hosted model). Without either, the copilot says it isn't set up instead of failing silently. Add provider keys, `PLATFORM_MODELS` and `ADMIN_EMAILS` to offer more models.
- **Email:** set a mail provider (`BREVO_API_KEY` with a verified `BREVO_FROM_EMAIL`, or OneSignal / Resend) or invites, meeting emails and reminders aren't delivered; the app says so when a send fails.

## Project layout

```
server.js                 API server entry (Express + Socket.IO)
server/runner/            code runner (no DB): engines, router, standalone service
server/routes/            REST routes (projects, snippets, meetings, AI, snapshots, …)
server/security/          sign-in verification and access rules for every API request
server/jobs/              meeting reminders / auto-end, hourly cleanup
server/sockets/           real-time rooms, whiteboard and media signalling
server/repositories/      Postgres access
src/                      React app (pages, components, styles/app.css design system)
src/shared/               shared by server and app: plans, languages, AI providers
desktop/                  Electron app for Windows, macOS and Linux
.github/workflows/        desktop release pipeline
```

---

Built by [Utkristi.io](https://utkristi-io.netlify.app).
