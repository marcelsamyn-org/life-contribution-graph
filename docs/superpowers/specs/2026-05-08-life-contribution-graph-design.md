# Life Contribution Graph — Design

**Date:** 2026-05-08
**Author:** Marcel Samyn (with Claude as collaborator)
**Status:** Approved for planning

## Purpose

A living, public visualization of Marcel's contributions over time. The point is not to encourage more output — it's to honor the act of giving and let go of expectation of outcome. The graph is a mirror, not a coach.

Sources tracked at launch:
- YouTube long-form videos (≥ 180s)
- YouTube shorts (≤ 180s)
- Instagram reels
- Instagram posts
- Instagram stories
- Commits on `marcelsamyn-org/book` (weighted by lines added)
- New public repositories created

## Non-goals

- **No streaks.** Streaks gamify continuity and push toward filler content.
- **No leaderboards or "best month" callouts.** Same reason.
- **No goals or targets.** The graph is a mirror.
- **No real-time freshness.** Daily granularity is the point; minute-level is noise.
- **No multi-user, no auth.** Single user, public surface.

## Architecture

```
┌──────────────────────────────┐    daily push     ┌──────────────────────┐
│  GitHub Actions cron (6h)    │ ─────────────────▶│  this repo           │
│  - fetch-youtube             │  appends to       │  data/events.jsonl   │
│  - fetch-instagram           │  data/events.jsonl└──────────┬───────────┘
│  - fetch-github              │                              │
│  - persist (idempotent)      │                              │ on push
└──────────────────────────────┘                              ▼
                                                ┌──────────────────────────┐
                                                │  Astro + React island    │
                                                │  Tailwind heatmap        │
                                                │  Netlify (static)        │
                                                └──────────────────────────┘
```

**Why GitHub Actions + static JSONL over a Cloudflare Worker + D1:**

- Data history lives in git. Every fetch is a commit. The history of giving is itself a contribution graph.
- Zero runtime infra. No DB to maintain, no secrets in a Worker, no migrations. Site is fully static.
- Failure mode is benign. If a fetch fails, yesterday's JSONL still serves. Failure visible in Actions UI.
- Cheap to throw away. Swappable to Worker + D1 in an afternoon if needed; data shape doesn't change.

**Why Netlify over Cloudflare Workers Static Assets:** Cloudflare Pages is being sunset in favor of Workers Static Assets, but for a fully static site with no Worker logic, Netlify is simpler — zero config, push-to-deploy, branch preview deploys out of the box, no `wrangler.toml` to maintain. If a dynamic surface is added later (OG image generation, webhook ingestion), reconsider Workers Static Assets.

**Astro over TanStack Start:** the page is 99% static with one interactive island. TanStack Start's full-stack request/response model is unused capacity here.

**Custom React heatmap component over a chart library:** ~150 lines of focused code; libraries are more constraint than help at this scope.

**Bun as runtime + package manager:** native TS, fast install, single tool. No tsx, no separate test runner.

## Data model

### `data/events.jsonl`

Append-only log, one event per line. Discriminated union on `source`, validated with Zod at load time.

```ts
const VideoEvent = z.object({
  id: z.string(),                       // e.g. "yt:dQw4w9WgXcQ"
  source: z.enum(['youtube_long', 'youtube_short', 'ig_reel']),
  date: z.string(),                     // YYYY-MM-DD, Marcel's local TZ
  durationSec: z.number().int(),
  title: z.string().optional(),
  url: z.string().url().optional(),
});

const PostEvent = z.object({
  id: z.string(),
  source: z.enum(['ig_post', 'ig_story']),
  date: z.string(),
  url: z.string().url().optional(),
  caption: z.string().optional(),
});

const CommitEvent = z.object({
  id: z.string(),                       // commit SHA
  source: z.literal('book_commit'),
  date: z.string(),
  linesAdded: z.number().int(),
  message: z.string().optional(),
});

const RepoEvent = z.object({
  id: z.string(),                       // "gh:<owner>/<repo>"
  source: z.literal('gh_repo_created'),
  date: z.string(),
  name: z.string(),
  url: z.string().url(),
});

const Event = z.discriminatedUnion('source', [VideoEvent, PostEvent, CommitEvent, RepoEvent]);
```

**Properties:**
- `id` is deterministic per event — re-running ingestion is a no-op.
- `durationSec` and `linesAdded` are first-class on the variants that need them, never buried in a generic `meta` blob.
- `date` is resolved to Marcel's local timezone at ingest time. A reel posted at 1am UTC counts toward the right day for him.

**Why JSONL over JSON array:**
- Git diffs are line-clean — adding 5 events shows 5 inserted lines.
- Append is `>>` — no read-modify-write.
- `wc -l data/events.jsonl` instantly tells lifetime contribution count.
- Streaming parse if it ever grows. `git log -L` works on individual events.

### `data/sources.json`

Identity only — labels, colors, default-enabled state. No scoring policy.

```ts
type Source = {
  id: SourceId;
  label: string;                  // "YouTube long-form"
  group: 'video' | 'social' | 'writing' | 'code';
  defaultEnabled: boolean;
  color: string;                  // OKLCH base for the source's chip
};
```

## Scoring policy: blast radius

Lives in `app/src/lib/blast.ts` — separate from `sources.json` so it's tunable without touching identity data.

Every event resolves to a `(date, intensity)[]` distribution rather than a single point. Long-form work spreads its intensity backward over multiple days, reflecting that effort happened *before* the post date.

**Conservation principle:** a long video doesn't *add* intensity by spreading — it redistributes. Spreading dilutes per-day intensity rather than amplifying total contribution. Otherwise blast radius becomes inflation, defeating the point.

```ts
type DayIntensity = { date: string; intensity: number };
type BlastFn = (event: Event) => DayIntensity[];

export const blastBySource: Record<SourceId, BlastFn> = {
  youtube_long:    durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'decay' }),
  youtube_short:   point(1),
  ig_reel:         point(1),
  ig_post:         point(1),
  ig_story:        point(0.3),
  book_commit:     linesCapped({ perLine: 1, cap: 200 }),
  gh_repo_created: point(5),
};
```

Defaults table:

| Source | Blast | Interpretation |
|---|---|---|
| `youtube_long` | `duration_days`, 600s/day, max 7, decay | 30min video → 3 days; 70min video → 7 days, fading backward. |
| `youtube_short` | `point`, weight 1 | One day. |
| `ig_reel` | `point`, weight 1 | One day. |
| `ig_post` | `point`, weight 1 | One day. |
| `ig_story` | `point`, weight 0.3 | Lower than a post — stories are ephemeral by design. |
| `book_commit` | `lines_capped`, 1/line, cap 200 | Lines added, capped per commit to dampen large refactors. |
| `gh_repo_created` | `point`, weight 5 | A new public repo is a meaningful gift. |

**User overrides** (UI sliders) live in `localStorage` and multiply on top — never written to the repo. The repo always reflects considered defaults.

## Frontend

Single Astro page, single React island that owns the interactive surface.

### Render pipeline

```
events.jsonl ──parse──▶ Event[]
                          │
                          │ filter by enabledSources (UI)
                          ▼
                       Event[]
                          │
                          │ flatMap(blastBySource[e.source])
                          ▼
                  DayIntensity[]
                          │
                          │ groupBy(date), sum
                          ▼
                Map<date, totalIntensity>
                          │
                          │ render onto 53×7 grid for selected year
                          ▼
                    Heatmap squares
```

Pure functions, all in-browser, runs in <5ms for thousands of events. `useMemo` over the chain; no further optimization.

### Color scale

Quantile-based across the visible year (not absolute). A quiet year still has bright squares relative to itself — the graph honors Marcel's rhythm, not a global threshold. Five buckets: empty, p25, p50, p75, p95+.

OKLCH interpolation for perceptually even steps:

```ts
import { interpolate, formatHex } from 'culori';
const scale = interpolate(
  ['oklch(0.96 0 0)',
   'oklch(0.85 0.08 145)',
   'oklch(0.72 0.14 145)',
   'oklch(0.58 0.18 145)',
   'oklch(0.42 0.20 145)'],
  'oklch'
);
export const bucket = (q: 0|1|2|3|4) => formatHex(scale(q / 4));
```

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ◀  2026  ▶                                                      │
│  ☑ YouTube long  ☑ shorts  ☑ Reels  ☑ Posts  ☐ Stories           │
│  ☑ Book          ☑ New repos                       [reset]       │
│                                                                  │
│   J  F  M  A  M  J  J  A  S  O  N  D                             │
│  ┌─────────────────────────────────────────────────────┐         │
│  │  [main heatmap, 53 cols × 7 rows]                   │         │
│  └─────────────────────────────────────────────────────┘         │
│                                                                  │
│  ▁ ▂ ▃ ▅ ▄ ▆ █ ▇ ▆ ▇ █   ← year minimap, full width             │
│  '20 '21 '22 '23 '24 '25 '26 '27 '28 '29 '30                     │
│                                                                  │
│   3,247 gifts this year     ← rotating footer                    │
└──────────────────────────────────────────────────────────────────┘
```

### Interaction

- **Hover square** → tooltip: total intensity + per-source breakdown.
- **Click square** → drawer with the events that day (titles, links, durations). The meditative surface — the point isn't the number, it's remembering what was given.
- **Year nav** → ◀/▶ arrows, dropdown, or click on minimap.
- **Source toggles** persisted in `localStorage` + URL hash so a link captures a view.
- **"You are here" hairline** on today's column in the active year + a marker on the active year's minimap bar. Toggleable.

### Minimap

Full-width strip below the main heatmap. One bar per year, height encodes total intensity normalized to the tallest year, color from the same OKLCH scale. Click a year to navigate. Sparse year ticks (every 5th + first/last/active). Empty years before the first event are omitted — the strip starts when life-on-this-graph begins.

Restraint: no legend, no axes, no average line. Just bars and ticks. The viewer fills in the meaning.

### Rotating footer

Letter-by-letter cross-fade between facts, ~10s per fact, ~25ms per char. Pauses when tab hidden.

```ts
type Fact = (events: Event[], year: number) => string | null;

export const facts: Fact[] = [
  (e, y) => `${countYear(e, y).toLocaleString()} gifts this year`,
  (e, y) => `${hoursOfLongForm(e, y)} hours of long-form video`,
  (e, y) => `${daysWritingBook(e, y)} days at the book this year`,
  (e, y) => `your quietest stretch: ${longestPause(e, y)} days`,
  (e, y) => `${reelCount(e, y)} reels, ${postCount(e, y)} posts, ${storyCount(e, y)} stories`,
  (e, y) => `first gift of the year: ${firstEventDate(e, y)}`,
];
```

A fact returning `null` (e.g. no book commits this year) is skipped — the rotation never lies.

## Ingestion

```
.github/workflows/ingest.yml         cron: every 6h
        │
        ▼
┌────────────────────────────────────────────────┐
│  bun run scripts/ingest/run.ts                 │
│                                                │
│  for each source in [yt, ig, github]:          │
│    try:    events = await source.fetch()       │
│    catch:  log, continue (other sources OK)    │
│                                                │
│  knownIds = readJsonl(events.jsonl).ids        │
│  novel = events.filter(e => !knownIds.has(e.id))│
│  appendJsonl(events.jsonl, novel)              │
│                                                │
│  if novel.length > 0:                          │
│    git commit -m "📊 +{n} (yt:3 ig:2 gh:1)"     │
│    git push                                    │
│  else:                                         │
│    exit 0  (no-op, no empty commits)           │
└────────────────────────────────────────────────┘
```

**Cadence: every 6h.** Instagram stories live for 24h; missing a window means losing those gifts forever. 6h gives 4 chances per story.

**Idempotency is structural.** Every event has a deterministic `id` (YouTube videoId, IG media id, commit SHA). Re-running is a no-op. No "last fetched at" cursor to corrupt.

**Per-source isolation.** Each source is its own module returning `Event[]`. A failure in one is logged; others still persist. The commit message is the run report.

### Source specifics

- **YouTube shorts detection:** API has no `isShort` flag. Heuristic: `durationSec ≤ 180`. Documented in `scripts/ingest/youtube.ts`.
- **Instagram token lifecycle:** long-lived tokens last 60 days. Separate weekly workflow `refresh-ig-token.yml` calls `/refresh_access_token` and writes the rotated token back via `gh secret set`. Self-healing.
- **Instagram media query:** `GET /{ig-user-id}/media?fields=id,media_type,media_product_type,timestamp,permalink,caption`. `media_product_type=REELS` distinguishes reels from posts (`FEED`).
- **Instagram stories:** separate endpoint `GET /{ig-user-id}/stories`. Returns currently-active stories only — must be polled within 24h of posting.
- **GitHub book repo:** `git clone --depth=0 --filter=blob:none` + `git log --shortstat --author=marcelsamyn` is faster and more accurate than the REST API for line counts, especially for older history.
- **GitHub new repos:** list public repos for `marcelsamyn` + `marcelsamyn-org`, filter by `created_at` since last persisted event.

### Secrets (repo Actions secrets)

```
YOUTUBE_API_KEY
YOUTUBE_CHANNEL_ID
IG_USER_ID
IG_LONG_LIVED_TOKEN          (rotated by refresh workflow)
META_APP_ID
META_APP_SECRET
GH_INGEST_PAT                (only if needed for org-private repos)
```

### Watchdog

Action sets a status check; if no successful run in >18h, GitHub emails Marcel. No third-party monitoring.

## Repo layout

```
life-contribution-graph/
├── app/                           — Astro site
│   ├── astro.config.ts
│   ├── src/
│   │   ├── pages/index.astro
│   │   ├── components/
│   │   │   ├── Graph.tsx          — root React island
│   │   │   ├── Heatmap.tsx
│   │   │   ├── Minimap.tsx
│   │   │   ├── SourceToggles.tsx
│   │   │   ├── DayDrawer.tsx
│   │   │   └── RotatingFooter.tsx
│   │   └── lib/
│   │       ├── schema.ts
│   │       ├── blast.ts
│   │       ├── compute.ts
│   │       ├── color.ts
│   │       ├── facts.ts
│   │       └── load-events.ts
│   └── public/
├── data/
│   ├── events.jsonl
│   └── sources.json
├── scripts/
│   └── ingest/
│       ├── run.ts
│       ├── youtube.ts
│       ├── instagram.ts
│       ├── github.ts
│       ├── persist.ts
│       └── lib/
│           ├── timezone.ts
│           └── http.ts
├── .github/workflows/
│   ├── ingest.yml                 — every 6h
│   └── refresh-ig-token.yml       — weekly
├── netlify.toml                   — build command + bun version
├── docs/superpowers/specs/
│   └── 2026-05-08-life-contribution-graph-design.md
├── tests/
│   ├── blast.test.ts
│   ├── compute.test.ts
│   ├── color.test.ts
│   └── ingest.test.ts             — fixtures, no live network
├── package.json                   — flat (no workspace)
├── tsconfig.json                  — strict, noUncheckedIndexedAccess
├── biome.json                     — lint + format
└── README.md
```

**Notable choices:**
- Flat repo, not a workspace. `app/` and `scripts/` share `tsconfig.json` and `node_modules`.
- Biome over ESLint + Prettier. Bun-native, single tool, fast.
- `data/` at repo root, not under `app/`. Astro reads it via build-time import.
- Tests on `lib/` only — pure functions are easy unit targets. UI gets fixture-based tests, no live API. No browser test layer for v1.

## Build & deploy

- `bun run build` → Astro static output in `app/dist/`.
- **Netlify** connects to the repo, builds with `bun run build`, publishes `app/dist/`, deploys on every push to `main`.
- `netlify.toml` at repo root pins the bun version and build command. No GitHub Actions deploy workflow needed — Netlify's repo integration is the deploy trigger.
- Cron workflow's commits to `main` trigger redeploys automatically. Site is fresh within minutes of each ingest.
- Branch deploys per PR for previewing visual tweaks before merging.

## Testing strategy

Pure-function-first. The lib/ modules (`blast`, `compute`, `color`, `facts`) are the load-bearing logic and are deterministic — bun test, fixture-based.

Ingestion modules tested with recorded fixtures (sample API responses), never live network. The `persist` step tested separately with temp JSONL files.

UI components are not unit-tested in v1. Manual verification + the visual feedback loop is sufficient at this scope.

## Open questions

None blocking. Tunables to revisit after first month of real data:
- Whether quantile bucketing makes very-quiet years feel artificially loud. May add an absolute floor.
- Whether 600s/day for `youtube_long` is the right pace; tune from observed feel.
- Whether `book_commit` cap of 200 lines is too aggressive once chapter drafts land in single commits.
