# Plan: external review, system-design whiteboard, icons

Written 25 Oct 2026. It covers the external product review, ideas from Breakscale for the whiteboard, and a single icon system.
The project card layout and the call unpin fix from the same request are already built; see the end of this file.

---

## 1. The external review: what fits CoLabs

The review was written without access to the app. It assumes a generic tracker plus docs product ("issues, PRs, ADRs").
CoLabs is a real-time coding workspace:
- rooms and projects;
- a live editor and runner;
- calls with screen share;
- a diagramming whiteboard;
- orgs, devices and a desktop app.

So the useful move is to take the review's *principles* and attach them to what CoLabs already does well, not to rebuild Linear.

### What already exists (checked in the code)

| Review item | In CoLabs today | Notes |
| --- | --- | --- |
| Workspaces / members | Partly | `server/routes/orgRoutes.js` has organizations and members. Projects are not yet scoped to an org in the UI. |
| Projects | Yes | Projects with nested files, versions (snapshots), analytics. |
| GitHub | Sign-in only | GitHub OAuth through Firebase (`AuthContext.js`), plus Gist export (`GistModal.js`). No repo, branch or PR link. |
| Technical docs | Partly | Problem pane (Markdown) in rooms. No project docs. |
| Architecture diagrams | Yes | Whiteboard with flowchart and system-design blocks, live for everyone. |
| Decisions (ADRs) | No | — |
| Issues / tasks | No | — |
| Loading / empty / error states | Mostly | Loader, ErrorBoundary and empty states exist. They are not audited everywhere. |
| Automated tests | No | No `*.test.js` files in `src/` or `server/`. |
| Server authorization audit | Not done | Needs a pass over every route. |

### Recommended, in order

**P0. Trust the core (1–2 weeks). Feasible now.**
1. **Authorization audit.** For each route in `server/routes/*` and each socket handler in `server/sockets/*`, write down who may call it and enforce that. Check especially:
   - project file read/write;
   - snapshots;
   - org members;
   - the device list;
   - socket room joins: a guest must not join a private project by guessing its id.
2. **Smoke tests.** Start with `react-scripts test` for small units:
   - `utils/paging.js`;
   - the layout hook;
   - `diagram.js` geometry.

   Then add one Playwright file for the main flows:
   - sign in as a guest;
   - create a room, type, run;
   - open a project, add a file, refresh, and check it is still there.
3. **Mutation feedback.** Show a "Saving… / Saved / Couldn't save — Retry" state for project file saves and renames. Most of the code is already in `ProjectPage`.

**P1. Connect code to work (3–5 weeks). Feasible, medium effort.**
- **GitHub repo link per project.** This is a GitHub App rather than the sign-in token. It covers:
  - import or push files;
  - show the last commit;
  - open a PR from a project snapshot.

  Do not show cached PR state as current; always show the "synced at" time.
- **Webhooks.** Verify signatures, store a delivery id, and process each delivery once (idempotent).

**P2. Decisions next to the diagram (2–3 weeks). This fits CoLabs best.**
- A **Decision** record:
  - title, status (proposed / accepted / superseded);
  - context, options, the chosen option, consequences;
  - author and date.
- Links it to:
  - a project;
  - a whiteboard element (for example "why is this a queue?");
  - a snapshot.
- On the board, a node with a decision shows a small badge. Clicking the badge opens the record.

This gives you "why the system is built this way" in a form no tracker has: the reasoning sits on the architecture itself.

**P3. Later, only if users ask**
- AI summaries of a session: what changed, what was decided, from chat and snapshots. Build this only after P0, so the AI never surfaces data a user can't access.
- Lightweight tasks per project (title, owner, status, link to file or decision). Don't build a full issue tracker.

**Don't build:**
- a full issue tracker;
- a second IDE inside the IDE;
- many integrations at once. GitHub first.

---

## 2. Breakscale ideas for the system-design whiteboard

[Breakscale](https://breakscale.tech) ([source](https://github.com/xevrion/breakscale), MIT licence) is a system-design *simulator*.
- You wire up components (load balancer, cache, DB, queue, workers and 29 more) and drag the traffic up.
- A discrete-event engine shows per-component throughput, busy %, p99 latency and queue depth, until something breaks.
- The engine (`src/sim/`) has no React or DOM dependency.
- Runs are deterministic: the same seed and topology replay identically.

What makes this attractive for CoLabs:
- **Our diagrams are already the right shape.** Our system-design blocks (client, service, database, cache, queue, LB, CDN) map almost one-to-one onto Breakscale component types.
- **Determinism fits multiplayer.** If the board syncs only the topology, seed and load-slider value (all of which are already synced), every person in the room computes identical numbers locally. No metric streaming is needed.

### Pieces worth implementing (ordered)

| # | Piece | What the user sees | Effort |
| --- | --- | --- | --- |
| 1 | **Capacity properties on blocks** | The selection toolbar gets a "⚙ Properties" popover: instances, concurrency, mean service time (ms), variability, queue limit, timeout, retries. The values are stored on the node (`node.sim = {...}`) and synced like any other update. | S |
| 2 | **Simulate mode** | A ▶ Simulate button and a load slider (1 → 5k req/s) in the board header. Nodes show live busy %, p99 and waiting; connectors show req/s; a saturated node turns amber, then red. | M–L |
| 3 | **Bottleneck explanation** | A one-line note under the slider, for example "Database is 98% busy: requests wait there first. Add a read replica or a cache." | S |
| 4 | **Chaos controls** | Right-click a node to crash it, slow it ×5 or force 20% errors; right-click a link to cut it. Everyone sees the failure spread. | S (after 2) |
| 5 | **Teaching templates** | "Cache aside", "Retry storm", "Rate-limited API", "Circuit breaker", "Async workers" as ready boards in the shape library. Each comes with a note and the slider preset at the breaking point. | S each |
| 6 | **Glossary on hover** | Hovering a metric explains it ("p99: 99 of 100 requests were faster than this"). | S |
| 7 | **Interview mode** | The interviewer sets a target, for example "2,000 req/s at p99 < 200 ms". The board shows pass or fail as the candidate edits. This fits the room's Problem pane. | M |
| 8 | **Export / import** | Import or export a `.breakscale` design, or open a board in Breakscale. Only worth doing if users ask; the format belongs to Breakscale. | M |

### How to implement 2 (Simulate) safely
- **Reuse, don't rewrite.** Vendor `src/sim/` into `src/components/whiteboard/sim/`, keeping the MIT licence header and a `NOTICE` line. The code is TypeScript. Either:
  - add `typescript` to the CRA build (CRA compiles `.ts` files when it's installed), or
  - vendor the compiled JS.
- **Run it in a Web Worker** (`sim.worker.js`), so the board stays at 60 fps. Every ~100 ms the worker posts a snapshot: per-node utilisation, p50/p99, queue depth and edge rates.
- **Mapping layer** (`toTopology(elements)`):
  - nodes with `kind` → component type, plus `node.sim` (or defaults);
  - connectors → links;
  - ignore freehand strokes, text and plain flowchart shapes.
- **Sync.** Simulation state is not stored or broadcast. Only the inputs are synced (`sim` props on nodes, a board-level `{ running, load, seed }`), and each client runs its own engine.
- **Rendering.** Metrics are drawn in `drawNode` as a small footer strip on the node, using existing tokens. Edge rates are drawn as connector labels while the simulation runs.
- **Keep their bar.** Show measured numbers only, never invented ones. If a block has no known capacity, it shows "no capacity set" rather than a fake value.

Things not to copy: their branding, the Caveat font (a separate licence), and their example texts word for word. Write our own notes and credit Breakscale in the About page.

---

## 3. One icon system across the platform

**Today:**
- 55 files import `lucide-react` directly. Sizes vary (12–20 px), strokes are default, and naming is ad hoc: `Video as VideoIcon`, `Layout` used for both "whiteboard" and "dashboard".
- There is one custom icon (`AiIcon.js`).
- There is no filled or "on" variant, so active states rely on background colour only.

The reference sheet you shared looks like a Fluent-style set: rounded geometry, with a matching *outline* and *filled* version of each icon. Filled marks "on/active" (for example, the mic is filled while live).

### Plan
1. **One component, one registry.** `src/components/icons/Icon.js`:
   ```jsx
   <Icon name="mic" size={16} filled={!isMuted} />
   ```
   - `name` comes from a registry such as `icons/registry.js`: `{ mic: { outline, filled }, … }`.
   - It keeps `aria-hidden` by default and accepts `label` for icon-only buttons.
   - Sizes are fixed tokens: 12 / 14 / 16 / 20 / 24.
2. **Source of the glyphs.** Pick one:
   - **(Recommended) Fluent UI System Icons** (`@fluentui/react-icons`, MIT). Every icon ships as `…Regular` and `…Filled` pairs, matching the reference sheet exactly. Import named icons only, so tree-shaking keeps the bundle small.
   - **Lucide plus custom filled SVGs.** Keep Lucide outlines and draw filled twins only for the ~20 icons that need an "on" state (mic, video, screen share, pin, hand, star, bell, chat, people, call). This is cheaper, but you maintain the SVGs yourself.
3. **Custom brand icons** for CoLabs-only concepts, drawn on the same 24 px grid, 1.75 px stroke, round caps and joins. Each gets an outline and a filled version:
   - room, project, whiteboard/diagram, AI (redo `AiIcon` in the same style), run, layout cards, dock/pop-out, presence cursor.
4. **Usage rules** (a one-page `icons/README.md`):
   - Outline by default. Filled only for a pressed or active toggle, or the current navigation item.
   - Don't mix two icons for one meaning. Whiteboard has one icon everywhere: header, command palette, mobile tab bar.
   - Icon-only buttons need `aria-label` and a tooltip.
5. **Migrate in order:**
   1. call controls (they benefit most from filled "on" states);
   2. workspace header actions and the mobile tab bar;
   3. whiteboard dock;
   4. site pages.

   Add an ESLint `no-restricted-imports` rule for `lucide-react` outside `icons/` once the migration is done, so it stays unified.

---

## 4. Already built in this change

- **Project card layout (optional).**
  - The status bar has a **layout** menu. **Classic** (the existing sidebar) stays the default.
  - Picking a card preset switches to cards: Files, Editor, Output, Chat, People, Call. Cards are draggable and resizable, and the call can dock into its card.
  - The room and the project share one layout engine (`RoomLayout.js`), each with its own config.
  - The choice is stored per browser (`project-layout-mode`, `project-layout-v1`).
- **Unpin in calls.**
  - A pinned person on the stage now shows an **Unpin** button.
  - Unpinning restores the view you had before pinning.
  - During a screen share, "Back to shared screen" and the strip's screen tile use the same unpin path.
- **Layout previews.** A general status-bar style (`.ws-status span`) collapsed the little layout previews in the menu to zero height. Fixed for both rooms and projects.
