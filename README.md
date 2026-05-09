# life contribution graph

A public, static visualization of Marcel Samyn's contributions over time — YouTube videos (long-form + shorts), Instagram posts / reels / stories, book commits, code commits to whitelisted repositories, and new public repositories.

> The point isn't to encourage more output. The graph is a mirror, not a coach. Inspired by David Deida's framing of giving without expectation of outcome.

---

## What this is, in one paragraph

Every six hours, a GitHub Actions cron job fetches recent activity from YouTube, Instagram, and GitHub, validates each item against a Zod schema, and appends novel events to `data/events.jsonl` — an append-only log committed to the repo. Netlify rebuilds the static Astro site from that log on every push. The frontend is a single React island that renders a heatmap of the configured `Range` (default: rolling last 365 days), with toggleable sources, an OKLCH-interpolated quantile color scale, a year-bar minimap, and a rotating fact line in the footer. There is no database, no backend, no analytics. The graph lives entirely in git.

---

## Anti-features (intentional)

- No streaks
- No goals or quotas
- No leaderboards or comparisons
- No "you missed N days" warnings
- No engagement-driving copy

If a feature would push toward "produce more," it doesn't belong here.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime + package manager | **bun** | Fast, single tool for runtime / installer / test runner |
| Framework | **Astro 5** | Static-first; one React island for interactivity |
| UI | **React 19** | Single `<Graph>` island under `client:load` |
| Styling | **Tailwind 4** (via `@tailwindcss/vite`) | Utility-first, no separate config file |
| Validation | **Zod 4** | Discriminated union event schema; runtime guarantees |
| Color | **culori** | Perceptually uniform OKLCH interpolation |
| Dates | **date-fns-tz** | Timezone-aware (`Europe/Brussels` by default) |
| Lint + format | **Biome** | Single fast tool replacing ESLint + Prettier |
| Deploy | **Netlify** | Pure static, push-to-deploy, branch previews |

---

## Architecture

```
                       ┌──────────────────────────┐
   GitHub Actions      │      data/events.jsonl    │      Netlify
   ─ cron 0 */6 * * *  │  (append-only, in git)    │  ─ build on push
   ─ run.ts orchestrator    ▲                              ─ static deploy
       │                    │                              ─ branch previews
       ├── youtube.ts ──────┤
       ├── instagram.ts ────┤
       └── github.ts ───────┘
                            │
                            └─ persist.ts (idempotent dedupe by event.id)
```

### Read path (Astro build → browser)

```
data/events.jsonl ─→ load-events.ts ─→ Zod parse ─→ Astro page
                                                       │
                                                       └─→ <Graph> island
                                                              │
                                ┌─────────────────────────────┤
                                │           │       │         │
                            Heatmap     Minimap  Range   RotatingFooter
                                          (years)  Selector
```

`Graph.tsx` owns three pieces of state:

- `enabled: Set<SourceId>` — which sources contribute to the totals (persisted to localStorage + URL hash key `s`)
- `selectedRange: Range` — the time window being viewed (persisted to URL hash key `r`)
- `selectedDate: string | null` — opens the side drawer

### Repository layout

```
app/                       Astro site
├── astro.config.ts
└── src/
    ├── pages/index.astro  reads data, mounts <Graph> island
    ├── components/        React (one island, dumb children)
    │   ├── Graph.tsx              root, owns state
    │   ├── Heatmap.tsx            DayCell[][] → grid
    │   ├── Minimap.tsx            year strip, click → calendar year
    │   ├── RangeSelector.tsx      Last 365 / 2026 / 2025 pills
    │   ├── SourceToggles.tsx      source filter chips
    │   ├── DayDrawer.tsx          per-day event list
    │   └── RotatingFooter.tsx     letter-staggered crossfade
    └── lib/               pure logic (no I/O)
        ├── schema.ts              Zod discriminated union
        ├── load-events.ts         JSONL parser
        ├── range.ts               Range type, rollingRange, calendarYearRange
        ├── compute.ts             filterEnabled / fanOut / groupByDay / rangeGrid
        ├── blast.ts               scoring policy (point / durationDays / linesCapped)
        ├── color.ts               OKLCH 5-bucket quantile scale (zero-aware)
        └── facts.ts               (events, range) → string | null

data/
├── events.jsonl           append-only log; the source of truth
├── sources.json           identity (id, label, color, default-enabled)
└── code-repos.json        whitelist of "owner/repo" strings to track for code commits

scripts/ingest/            run via `bun run ingest`
├── run.ts                 orchestrator (per-source isolation)
├── persist.ts             idempotent JSONL append, dedupes by event.id
├── youtube.ts
├── instagram.ts
├── github.ts              new public repos + book commits
├── code-commits.ts        commits in data/code-repos.json (point 1 each)
├── refresh-ig-token.ts    standalone (weekly workflow)
└── lib/
    ├── timezone.ts        toLocalDate via date-fns-tz
    └── http.ts            fetchJson with exponential backoff

tests/                     Bun test runner; one file per module
.github/workflows/
├── ingest.yml             cron every 6h
└── refresh-ig-token.yml   weekly Sunday
netlify.toml               build + headers config
```

### Two important separations

1. **Source identity vs scoring policy.** `data/sources.json` holds *what a source is* (label, color). `app/src/lib/blast.ts` holds *how much weight an event carries* across days. You can retune the scoring without touching data, and add data without touching the scoring file.
2. **Range vs year.** Internal API is `Range = { start, end, label }`. "Last 365 days" and "calendar 2026" are just two `Range` values. The grid width and fact text both adapt automatically.

---

## Running locally

```bash
bun install
bun run dev          # http://localhost:4321
bun test             # 81 tests across 13 files
bun run check        # astro check + tsc --noEmit
bun run lint         # biome
bun run build        # outputs to app/dist/
```

The dev server reads `data/events.jsonl` directly. If the file is empty (first-run state) the page renders the empty heatmap; once you populate it the heatmap fills in.

---

## Ingestion

### Manual run (local)

```bash
export YOUTUBE_API_KEY=…
export YOUTUBE_CHANNEL_ID=…
export IG_USER_ID=…
export IG_LONG_LIVED_TOKEN=…
export GH_AUTHOR_LOGIN=…   # your GitHub login, used to filter commits in tracked repos
export GH_INGEST_PAT=…     # optional; lifts the 60 req/h anonymous rate limit
bun run ingest
```

To track commits from specific repos, edit `data/code-repos.json`:

```json
[
  "marcelsamyn/example",
  "marcelsamyn-org/another"
]
```

Each commit authored by `GH_AUTHOR_LOGIN` in any of those repos becomes one `code_commit` event with weight 1. Unlike `book_commit` (which scales with `linesAdded`), code commits are deliberately flat — the graph honors the act of showing up, not the diff size.

Output is a one-line summary like `📊 +5 (youtube:2 instagram:3 github:0)`. The orchestrator exits non-zero **only if every source fails** — one source's outage doesn't block the others.

### Automatic (GitHub Actions)

`.github/workflows/ingest.yml` runs every 6 hours. The 6-hour cadence is dictated by Instagram stories, which expire after 24 hours — 6h gives four chances to capture each one before it's gone. The workflow only commits when novel events were appended, using the orchestrator's summary line as the commit message.

`.github/workflows/refresh-ig-token.yml` runs weekly. Instagram long-lived tokens expire after 60 days; this hits `/refresh_access_token` and rotates the secret in place via `gh secret set`.

---

## First-time setup (deploying this from scratch)

These are the manual steps required after cloning, before the cron can do useful work.

### 1. Push to GitHub

```bash
git remote add origin git@github.com:<you>/life-contribution-graph.git
git push -u origin main
```

### 2. Connect Netlify

In the Netlify dashboard: **Add new site → Import an existing project → GitHub → pick the repo**. Build command and publish directory are auto-detected from `netlify.toml`. First deploy renders the empty-state page (no events yet — that's expected).

### 3. Add the Actions secrets

In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**, add each of the following. Setup details for each are below.

| Secret | Required by | Notes |
|---|---|---|
| `YOUTUBE_API_KEY` | YouTube ingester | Server key, restricted to YouTube Data API v3 |
| `YOUTUBE_CHANNEL_ID` | YouTube ingester | The `UC…` channel id (NOT the @handle) |
| `IG_USER_ID` | Instagram ingester | Numeric Instagram Business/Creator account id |
| `IG_LONG_LIVED_TOKEN` | Instagram ingester | 60-day token; auto-rotated weekly |
| `GH_AUTHOR_LOGIN` | Code-commits ingester | Your GitHub login (e.g. `marcelsamyn`); used to filter commits |
| `GH_INGEST_PAT` | GitHub + code ingesters | Optional; lifts anonymous rate limit, also needed for private-repo access |
| `GH_PAT_FOR_SECRETS` | Token-refresh workflow | Fine-grained PAT, this repo only, Secrets RW |

### 4. Trigger the first ingest

GitHub repo → **Actions → ingest → Run workflow**. After it completes, `data/events.jsonl` will have content and Netlify will rebuild automatically.

---

## How to get each secret

### YouTube — `YOUTUBE_API_KEY` and `YOUTUBE_CHANNEL_ID`

**API key:**

1. Go to <https://console.cloud.google.com/> and create (or select) a project.
2. **APIs & Services → Library → search "YouTube Data API v3" → Enable**.
3. **APIs & Services → Credentials → Create credentials → API key**.
4. Click the new key → **Edit API key**:
   - **API restrictions:** restrict to **YouTube Data API v3** only.
   - **Application restrictions:** none (server-to-server use).
5. Copy the key.

**Channel ID:**

1. Go to <https://www.youtube.com/account_advanced> while logged in.
2. Copy the value labeled **YouTube channel ID** (starts with `UC…`).

The free quota (10 000 units/day) is plenty for this workload. The ingester uses ~3 units per uploads page + 1 per video for the duration lookup.

### Instagram — `IG_USER_ID` and `IG_LONG_LIVED_TOKEN`

The Instagram Graph API requires a **Business or Creator** account (not personal). Setup is fiddly but only needs to be done once.

1. Convert your IG account to **Business** or **Creator** (Settings → Account type).
2. Create a Meta app at <https://developers.facebook.com/apps/> → **Other → Business**.
3. In the app dashboard, add the **Instagram Graph API** product (or **Instagram Basic Display** if you only need posts and stories — but Graph API is required for full media metadata including `media_product_type`).
4. **App roles → Roles → Add Instagram tester** with your IG account, then accept the invite from the Instagram app.
5. Get a **short-lived user access token** from **Tools → Graph API Explorer**: select your app, set permissions to `instagram_basic` + `instagram_manage_insights` (and `pages_show_list` if your IG is connected to a Facebook Page), generate the token.
6. Exchange it for a **long-lived token** (valid 60 days):
   ```bash
   curl -G "https://graph.instagram.com/access_token" \
     -d "grant_type=ig_exchange_token" \
     -d "client_secret=<META_APP_SECRET>" \
     -d "access_token=<SHORT_LIVED_TOKEN>"
   ```
   The response gives you `access_token` (this becomes `IG_LONG_LIVED_TOKEN`) and `expires_in` (≈ 5 184 000 seconds = 60 days).
7. Get your **IG user id** with the long-lived token:
   ```bash
   curl "https://graph.instagram.com/v22.0/me?fields=id,username&access_token=<LONG_LIVED_TOKEN>"
   ```
   The `id` field is `IG_USER_ID`.

After initial setup, the `refresh-ig-token` workflow rotates the long-lived token weekly so it never expires.

### GitHub — `GH_AUTHOR_LOGIN` and `GH_INGEST_PAT`

`GH_AUTHOR_LOGIN` is just your GitHub login (e.g. `marcelsamyn`). The code-commits ingester uses it to filter commits in whitelisted repos.

`GH_INGEST_PAT` is **optional** but recommended if you track more than a couple of repos:

- Anonymous GitHub API calls are rate-limited to 60 req/h — easy to blow through with a few repos × 100 commits/page.
- Authenticated calls get 5 000 req/h.
- Required if you want to track commits in a private repo, or include private repos in the `gh_repo_created` count.

To create the PAT:

1. <https://github.com/settings/personal-access-tokens/new> → **Fine-grained token**.
2. **Resource owner:** your account (or the org).
3. **Repository access:** *Public repositories (read-only)* is enough; pick *Selected repositories* if you want private inclusion.
4. **Permissions → Repository → Metadata: Read-only**, **Contents: Read-only**.
5. Generate, copy.

### Tracking code commits in specific repos

Edit `data/code-repos.json` and add a string per repo:

```json
[
  "marcelsamyn/some-project",
  "marcelsamyn-org/another"
]
```

The ingester will fetch commits authored by `GH_AUTHOR_LOGIN` from each, dedupe by SHA, and append them as `code_commit` events. Re-running is idempotent (the SHA is in the event id). The default scoring is `point(1)` — one commit, one quiet day-mark, regardless of size.

If you want to retune (e.g., cap at one credit per day per repo, or weight by repo), edit `blastBySource.code_commit` in `app/src/lib/blast.ts`.

### `GH_PAT_FOR_SECRETS` — for the IG token refresh

The default `GITHUB_TOKEN` provided to workflows can read secrets but **not write** them. Rotating `IG_LONG_LIVED_TOKEN` requires a separate fine-grained PAT.

1. <https://github.com/settings/personal-access-tokens/new> → **Fine-grained token**.
2. **Resource owner:** your account.
3. **Repository access:** *Only select repositories* → pick `life-contribution-graph` only.
4. **Permissions → Repository → Secrets: Read and write**.
5. Generate, copy. Add as the `GH_PAT_FOR_SECRETS` secret in the same repo.

Set its expiration to **1 year** and put a reminder in your calendar to rotate it.

---

## Adding a new source

1. **Identity:** add an entry to `data/sources.json` with a new `id`, `label`, `group`, `color`, and `defaultEnabled`.
2. **Schema:** add the new `id` to the `SourceId` enum in `app/src/lib/schema.ts`. If the event variant has unique fields, add a new shape to the `Event` discriminated union.
3. **Scoring:** add an entry to `blastBySource` in `app/src/lib/blast.ts`. Pick `point(weight)` for a single-day signal, `durationDays(...)` for a time-investment signal that spreads backward, or `linesCapped(...)` for a magnitude-with-cap signal.
4. **Day-drawer copy:** add a `case` to `eventLabel` in `app/src/components/DayDrawer.tsx`.
5. **Ingester (if automatable):** add a `scripts/ingest/<name>.ts` and wire it into `run.ts`. Use a deterministic event id (e.g., `<source>:<external_id>`) so re-runs are idempotent.

The TypeScript exhaustiveness checks will flag every place you missed.

---

## How the scoring works

Each source has a `BlastFn: (event) => DayIntensity[]`. The function returns a list of `(date, intensity)` pairs.

- **`point(weight)`** — emits one cell with the given weight. Used for posts, repos, etc.
- **`durationDays({ secondsPerDay, maxDays, shape })`** — for video events. Spreads intensity backward from the post date over `ceil(durationSec / secondsPerDay)` days, capped at `maxDays`. **Conservation principle:** total intensity = number of days, never inflated by spreading. `shape: 'flat'` distributes evenly; `'decay'` peaks on the post date and tapers backward.
- **`linesCapped({ perLine, cap })`** — for book commits. `intensity = min(linesAdded * perLine, cap)`. The cap prevents a single huge commit from dominating the year.

Color buckets are **quantile-based and zero-aware**: zero-intensity days are excluded from the quantile computation, so a quiet year still produces meaningful color variation on the active days instead of pulling all cut points down to zero. Five buckets, interpolated in OKLCH from `oklch(0.96 0 0)` (paper) to `oklch(0.42 0.20 145)` (deep verdant).

---

## Testing

```bash
bun test                    # all 13 files
bun test tests/blast.test.ts   # one file
```

Unit tests cover all of `app/src/lib/*` and the ingester parsing functions (using JSON fixtures in `tests/fixtures/`). The actual API-calling functions in the ingesters are not unit-tested — they're integration-tested by running them against the real APIs in dev.

---

## Design references

- `docs/superpowers/specs/2026-05-08-life-contribution-graph-design.md` — the full spec
- `docs/superpowers/plans/2026-05-09-life-contribution-graph.md` — the 23-task implementation plan, including a "range-first model" mid-plan amendment

---

## License

Personal project; no license granted. Fork freely for inspiration; please don't republish as-is.
