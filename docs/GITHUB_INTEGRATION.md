# GitHub integration

People connect their own GitHub account once (Settings > Connections, or the **GitHub** item in a room's or project's ⋯ menu). After that they can:

- **Push** a room's file or a project's files to a new or existing repository, on any branch, into an optional folder. All files go in **one commit**, made with the git data API (tree, then commit, then a ref update).
- **Import** a repository folder from any branch into a new project or into the open project. Text files only: binary files, files over 1 MB and anything past 300 files are skipped, and the import says how many.
- **Sync** a project with a branch (and folder). The Sync tab shows what changed here and on GitHub since the last sync. **Pull** brings GitHub's changes in and stops with a conflict notice when a file changed on both sides (keep mine or take GitHub's). **Commit & push** sends the project's changes as one commit, and refuses while GitHub has changes you haven't pulled.
- **Share as gist**: the room's code, the open project file, or all project files, secret or public.

## Set up the OAuth app

1. On GitHub go to **Settings > Developer settings > OAuth Apps > New OAuth App** (or the same under an organization).
2. Fill in:
   - **Application name**: Utkristi CoLabs (or your own name).
   - **Homepage URL**: the site, for example `https://utkristi-colabs.onrender.com` or `http://localhost:3000`.
   - **Authorization callback URL**: the **API server** followed by `/api/github/callback`, for example `https://utkristi-colabs.onrender.com/api/github/callback` or `http://localhost:5000/api/github/callback`.
3. Create the app, then **Generate a new client secret**.
4. Add to the server's `.env`:

   ```env
   GITHUB_CLIENT_ID=Ov23li…
   GITHUB_CLIENT_SECRET=…
   GITHUB_TOKEN_ENCRYPTION_KEY=…   # openssl rand -base64 32
   APP_URL=https://utkristi-colabs.onrender.com
   # Optional:
   # GITHUB_CALLBACK_URL=https://api.example.com/api/github/callback  # if the server can't work out its own public URL (proxies)
   # CLIENT_URL=https://another-frontend.example.com                   # another web origin allowed to receive people back after connecting
   ```

5. Restart the server. The `github_connections` and `github_links` tables are created on start.

One OAuth app allows a single callback URL, so use one app for local development and another for production.

Without these variables the app runs normally: the GitHub screens say GitHub isn't set up on this server.

### Variables

| Variable | Required | What it does |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | yes | The OAuth app's client ID. |
| `GITHUB_CLIENT_SECRET` | yes | The OAuth app's client secret. Server only. |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | yes | Encrypts stored tokens (AES-256-GCM) and signs the OAuth `state`. Any long random string. **Changing it makes every stored token unreadable**, so everyone has to connect again. |
| `GITHUB_CALLBACK_URL` | no | The callback URL sent to GitHub. Defaults to `<protocol>://<host of the request>/api/github/callback`, using `X-Forwarded-Proto` behind a proxy. It must match the OAuth app exactly. |
| `APP_URL` | recommended | The public site. After connecting, people return to `APP_URL` or a `localhost` origin (development and the desktop app); any other return address falls back to `APP_URL/settings`. |
| `CLIENT_URL` | no | One more web origin allowed as a return address. |
| `FIREBASE_API_KEY` | no | Used to verify the caller's Firebase ID token, as billing does. Falls back to `REACT_APP_FIREBASE_API_KEY`. |

`GITHUB_TOKEN`, used by `/api/release/latest`, is unrelated and unchanged.

## How it works

- **Who is calling.** Every `/api/github/*` request carries the Firebase ID token (`Authorization: Bearer …`), checked the same way as billing. A user id in the body is never trusted.
- **Connecting.**
  1. `GET /api/github/connect?returnTo=…` returns the GitHub authorize URL with a signed, 10-minute `state` (the user and the return address). The client opens it in a popup, or in the same tab from Settings. The client navigates there itself, because the request needs the Firebase token header, which a plain browser redirect can't send.
  2. GitHub redirects to `GET /api/github/callback`. The server exchanges the code, reads the GitHub login, and stores the token encrypted in `github_connections` (user_id, gh_login, token_encrypted, scopes, created_at).
  3. The server redirects to `returnTo` with `?github=connected` (or `?github=error&reason=…`). In a popup, the Settings page tells the room or project that opened it and closes itself.
- **Disconnecting.** `DELETE /api/github` revokes the app's grant on GitHub (best effort) and deletes the row.
- **The token never reaches the browser.** Repository lists, branches, pushes, imports, sync and gists all go through server routes:

  | Route | Purpose |
  | --- | --- |
  | `GET /api/github` | Connection status: `{ configured, connected, login, scopes }`. |
  | `GET /api/github/repos` | Repositories the person can see, most recently pushed first. |
  | `GET /api/github/repos/:owner/:repo/branches` | Branches and the default branch. |
  | `GET /api/github/repos/:owner/:repo/folders?branch=` | Folders, for the import and link pickers. |
  | `POST /api/github/push` | One commit. Body: `{ owner, repo` or `createRepo: { name, private }`, `branch, folder, message, files }`. |
  | `POST /api/github/import` | Body: `{ owner, repo, branch, path, projectId` or `newProject: { name }`, `link }`. |
  | `POST /api/github/gists` | Body: `{ description, isPublic, files }`. |
  | `GET/POST/DELETE /api/github/projects/:id/link` | Read, create or remove a project's link (`github_links`). |
  | `POST /api/github/projects/:id/status` | Changes here and on GitHub since the last sync. Body: `{ files }`. |
  | `POST /api/github/projects/:id/pull` | Body: `{ files, resolve? }`, where `resolve` is `"mine"` or `"theirs"`. Returns 409 with `conflicts` when it's needed. |
  | `POST /api/github/projects/:id/push` | Body: `{ files, message }`. Returns 409 `PULL_FIRST` while GitHub has unpulled changes. |

- **Sync.**
  - A link stores the repo, branch, folder and `base_sha`: the commit the project and GitHub last agreed on.
  - Status compares three versions of every file by git blob SHA: the project's content (hashed on the server), the tree at `base_sha`, and the tree at the branch head. This needs no blob downloads.
  - Pull downloads only the files GitHub changed, writes them to `project_files`, and moves `base_sha` to the head. Collaborators who have the project open reload its files (`project-files-synced` socket event).
  - Push commits the project's changes, deletions included, on top of the head without force, then moves `base_sha` to the new commit.
  - Repo files a project can't hold (binary, over 1 MB) are recorded in `github_links.skipped`, so their absence is never committed as a deletion.
- **Empty repositories.** The git data API can't write to a repository with no commits. The first file goes in through the contents API, which creates the branch, and the rest follow in one commit. New repositories made from the Push tab start with a README, so this only applies to repositories that already exist and are empty.

## Limits

- 300 files per push, import or sync.
- 1 MB per file. Request bodies for `/api/github/*` are capped at 10 MB.
- Text files only. Imports skip symlinks and submodules.
- Very large repositories (where GitHub truncates the recursive tree) can't be imported or synced at the root. Pick a folder.
- The client sends the files it has open. Edits made in the last moment before a push or pull are included even if they haven't been saved yet.
