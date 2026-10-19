# Utkristi CoLabs: go-to-market plan

Working document. Numbers marked *(assumption)* are starting guesses to be replaced with real data after the first 60 days.

## 1. Where we stand

**Product:** real-time collaborative IDE. Live cursors, voice and video, whiteboard, chat, 17 runnable languages, SQL over imported CSV/JSON, projects and snapshots, an AI copilot (hosted or local), desktop apps for Windows, macOS and Linux, push and email notifications.

**Pricing (implemented):** Free (10 projects, 10 AI prompts a day, everything else) / Team $12 per member per month or $10 on yearly billing, 14-day trial / Enterprise on request. Guests never need an account or a plan.

**Honest strengths:** zero-install joining by link, a generous free tier, a desktop app that runs code and AI on the user's machine, a calm and fast interface.

**Honest gaps to close before spending money on ads:**
- Server cold starts on the free host make the first visit slow. Move the API to an always-on instance before any launch push.
- Desktop installers are unsigned (SmartScreen and Gatekeeper warnings). Buy a code-signing certificate and an Apple Developer account before the main launch.
- No customer proof yet: no testimonials, no case studies, no public usage numbers.

## 2. Positioning

**One line:** *Pair programming that feels like sitting side by side, with nothing to install.*

**Category:** collaborative coding for interviews, teaching and remote pairing. Not "another IDE".

**Against alternatives**

| Alternative | Their pull | Our angle |
|---|---|---|
| VS Code Live Share | Familiar editor | No install, works for guests in a browser, voice/video/whiteboard built in |
| Replit / CodeSandbox | Hosting and deploys | Lighter and faster to start, desktop app runs locally, simpler pricing |
| CoderPad / HackerRank | Interview tooling | Free for interviewers, not tied to hiring, also useful after the interview |
| Zoom + screen share | Everyone has it | Both people can type; the code and the call live in one place |

**Messaging pillars** (use these in every channel)
1. *Start in seconds.* A link is all it takes. Guests join without an account.
2. *Everything in one room.* Code, voice, video, whiteboard, chat, run.
3. *Runs where you are.* 17 languages, SQL on your own CSV, desktop apps with local runner and local AI.
4. *Free to begin, fair to grow.* Real free tier, one paid plan, no seat minimums.

## 3. Who we are for

Ranked by how fast they convert and how much they refer.

1. **Interviewers and hiring engineers (primary).** Need a shared editor now, hate setup, run several interviews a week. Entry point: the free room link. Upgrade trigger: want saved sessions and snapshots.
2. **Educators, bootcamps and student groups.** One teacher, many learners; low budget; high word of mouth. Entry point: free tier plus a classroom guide. Upgrade trigger: organizations and project limits.
3. **Small remote teams (2 to 15 engineers).** Pair daily, debug together. This is the Team plan buyer.
4. **Freelancers and indie developers.** Pair with clients. Free tier, occasional Team.

*Out of scope for the first six months:* large enterprises (sales cycle, security reviews). Collect Enterprise leads through the pricing page and answer them personally.

## 4. Funnel and the numbers to watch

Visit → **Try a room** (guest or sign-up) → **Activate** (second person joins, or code is run) → **Retain** (returns within 7 days) → **Convert** (starts Team trial) → **Pay** (trial becomes paid) → **Refer** (invites someone).

| Metric | Target at day 90 *(assumption)* |
|---|---|
| Landing page to room started | 12% |
| Rooms with 2+ people | 45% of rooms started |
| Week-1 return rate of room creators | 25% |
| Free to Team trial start | 3% of active free accounts |
| Trial to paid | 40% |
| Monthly logo churn on Team | under 5% |
| Weekly rooms | 2,000 |
| Paying seats | 150 (about $1,500 MRR) |

Instrument first, spend second. These events are now recorded in `analytics_logs`: `ROOM_STARTED` and `SECOND_USER_JOINED` (server, from the room socket), `TRIAL_STARTED` (server, from the Stripe webhook), `CODE_RUN` and `UPGRADE_CLICKED` (browser, allow-listed endpoint `/api/analytics/event`). Set `ANALYTICS_ADMIN_KEY` and read the funnel with `GET /api/analytics/funnel?days=30` and header `x-admin-key`; it returns counts per step plus the rooms-with-a-second-person, rooms-that-ran-code and click-to-trial rates.

## 5. Pricing and packaging decisions

- **Free stays generous.** The product spreads when people invite guests; guests must never hit a wall. Limits sit on *persistence and AI*, not on collaboration.
- **Limits chosen:** 10 projects and 10 AI prompts a day on Free. Both are visible in the dashboard and in Settings so a limit is never a surprise. Local AI in the desktop app is uncapped on purpose: it costs us nothing and it is a reason to install.
- **Trial:** 14 days, card collected by Stripe up front, no charge if cancelled. A card-up-front trial converts better than a card-free one; revisit if sign-up friction looks high.
- **Yearly plan:** 17% off ($120 instead of $144). Default the toggle to Yearly. Target 40% of paying seats on yearly: it cuts churn and funds growth.
- **Next experiments:** annual-only launch offer (first 100 teams, 30% off the first year), student pricing with `.edu` verification, a per-room "Pro room" add-on for interviewers who do not want a subscription.
- **Regional pricing:** a large part of the audience is in India and other lower-income markets. Test a localized price (Stripe supports multi-currency) once there are 50 paying seats.

## 6. Channels

### 6.1 Owned (start now, compounding)
- **Website SEO.** Landing and pricing already carry meta tags, a sitemap and structured data. Add landing pages per intent: *online code editor for interviews*, *collaborative code editor*, *pair programming tool*, *run SQL on CSV online*, *online compiler for 17 languages*. One page each, 600 to 900 words, real screenshots.
- **Blog (2 posts a month):** how we built conflict-free sync, running untrusted code safely, running a local AI model for code, pairing playbooks, interview-with-a-room templates.
- **Free tools as top-of-funnel.** "Run SQL on a CSV" and "Online compiler" as indexable pages that drop the visitor into a real room. Search intent is high and the product is the tool.
- **Email lifecycle** (Brevo with OneSignal fallback is already wired): welcome (day 0), "run your first code together" (day 1), "invite someone" (day 3), trial reminders (day 11 and day 13), win-back (day 30 inactive). Maximum one marketing email a week; unsubscribe is honoured.
- **In-product prompts:** the dashboard plan card, limit toasts with an upgrade path, an invite prompt after the first run, "download the desktop app" prompt on Windows/macOS/Linux browsers.

### 6.2 Community and earned
- **Launch posts:** Product Hunt, Show HN, r/webdev, r/programming (read each community's self-promotion rules first), dev.to and Hashnode write-ups of the technical posts. Lead with the engineering story, not the pitch.
- **Open source goodwill.** The repository is public. Keep the README sharp, label good-first-issues, and publish the runner as a reusable component.
- **Campus programme (India first):** free Team seats for student clubs and bootcamp cohorts, a 10-minute demo kit and a poster. Ambassadors get swag and a referral code. Students become the interviewers and team leads of 2 to 4 years from now.
- **Creators:** short YouTube and Instagram Reels demos ("pair on a bug in 60 seconds"), sponsor 5 to 10 small developer-education channels rather than one large one.
- **Integrations that bring traffic:** GitHub gist export exists; add "Open in CoLabs" badge for README files and a browser extension that turns a GitHub file or LeetCode problem into a room.

### 6.3 Paid (only after activation is above target)
- Budget *(assumption)*: $300 a month for the first two months, split between Google Search (high-intent keywords above) and developer newsletters. Pause anything with CAC over $30 per activated team.
- Retargeting pricing-page visitors with the trial offer.

## 7. Launch timeline

**Weeks -4 to -1: ready the ground**
- Always-on hosting; signed desktop installers; Stripe live mode with a test purchase end to end; webhook alerting.
- Event tracking for the funnel; a public status page (exists).
- Five design partners (teachers or small teams) using it weekly; collect two quotes and one case study.
- Landing pages, three blog posts, a 90-second demo video, screenshots, press kit.

**Week 0: launch**
- Tuesday or Wednesday: Product Hunt (prepared with a maker comment and a launch offer), Show HN the same day or the day after.
- Same week: announcement email to the waiting list and to every existing user, posts on social channels, a founder thread on how it was built.
- Everyone on the team answers every comment and support message within hours.

**Weeks 1 to 4: learn**
- Daily review of the funnel. Fix the biggest drop-off first. Interview ten users who activated and ten who did not.
- Ship the top two requested features publicly with a changelog post.

**Weeks 5 to 12: compound**
- Start the campus programme and creator sponsorships. Publish 4 SEO pages and 4 posts. Launch the first pricing experiment. Turn on paid search if activation targets are met.

## 8. Content calendar (first 8 weeks)

| Week | Anchor piece | Supporting |
|---|---|---|
| 1 | Launch post: "Code together, remotely" | Demo video, Product Hunt, Show HN |
| 2 | How conflict-free sync keeps cursors honest | Thread, dev.to repost |
| 3 | Running untrusted code safely with Judge0 | Landing page: online compiler |
| 4 | Run a local AI copilot on a laptop | Desktop download push |
| 5 | The interviewer's guide to live coding (template rooms) | Landing page: interview editor |
| 6 | SQL on a CSV in 30 seconds | Landing page: run SQL on CSV |
| 7 | A teacher's playbook for live coding classes | Campus programme kickoff |
| 8 | Eight weeks in: what the numbers say | Public changelog, pricing experiment |

## 9. Customer success and support

- Reply to every support message by email from a person within one business day; security reports get priority.
- Onboarding checklist in the dashboard (exists) plus a sample room that works out of the box.
- Public changelog and roadmap; ask for votes on the next three features.
- Cancel flow is self-serve in the billing portal. Ask one question on cancellation and read every answer.

## 10. Measurement and cadence

- **Weekly (30 minutes):** funnel table, top three drop-offs, one experiment in flight, one thing shipped.
- **Monthly:** MRR, trial-to-paid, churn, CAC by channel, NPS from a two-question in-app survey (after the fifth room).
- **Rule:** every experiment has a hypothesis, one metric and a stop date written down before it starts.

## 11. Budget (first 90 days) *(assumption)*

| Item | Cost |
|---|---|
| Always-on hosting, database, email | $60 to $120 a month |
| Code-signing certificate and Apple Developer account | about $200 to $400 a year |
| Paid search and newsletters | $300 a month for two months |
| Campus swag and creator sponsorships | $400 |
| Domain, analytics, tooling | $50 |
| **Total** | **about $1,500 to $1,900** |

## 12. Risks

| Risk | Mitigation |
|---|---|
| Free-host cold starts hurt first impressions | Always-on instance before launch; splash screen already hides waits in the desktop app |
| Running untrusted code is abused | Rate limits (exist), sandboxed Judge0, local-first execution on desktop, abuse reporting in Terms |
| Free tier cost grows faster than revenue | AI cap per day, hosted-model fallback to local, review costs weekly |
| Larger competitors copy features | Stay faster and simpler; win on the guest experience and the desktop app |
| Payment or webhook failure leaves a customer on the wrong plan | Webhook is the single source of truth; add an alert on webhook errors and a manual "resync" in support tooling |

## 13. What the code already does for this plan

- Pricing shows up where people decide: a landing-page pricing section, a "Team from $10/mo" link in the top strip, a "See pricing" button on every closing call to action, plan details in the sign-up copy, billing notes on Support, Security, Privacy and Terms.
- Pricing page with monthly/yearly toggle, comparison table, FAQ and trial messaging; Stripe Checkout, customer portal and signed webhooks; plan state stored per user.
- Free limits enforced on the server (projects, AI prompts), with upgrade prompts in the product; usage meters in the dashboard and Settings.
- SEO basics: meta and Open Graph tags, structured data, `robots.txt`, `sitemap.xml`, per-page titles.
- Lifecycle plumbing: Brevo email with OneSignal fallback, push notifications, billing notifications on plan changes.
- Release pipeline and a download page that always links the latest installers.
