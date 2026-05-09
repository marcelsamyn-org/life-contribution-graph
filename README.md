# life contribution graph

A public, static visualization of Marcel Samyn's contributions over time — YouTube videos, Instagram posts/reels/stories, book commits, new repositories.

The point isn't to encourage more output. The graph is a mirror, not a coach.

## Running locally

```bash
bun install
bun run dev          # http://localhost:4321
bun test             # run unit tests
bun run check        # type-check + astro check
bun run lint         # biome
```

## Ingestion (manual run)

```bash
export YOUTUBE_API_KEY=...
export YOUTUBE_CHANNEL_ID=...
export IG_USER_ID=...
export IG_LONG_LIVED_TOKEN=...
bun run ingest
```

## Architecture

- `data/events.jsonl` — append-only log; one event per line. The history of giving lives in git.
- `data/sources.json` — identity-only source config (label, color, default-enabled).
- `app/src/lib/blast.ts` — scoring policy ("blast radius"). Tunable without touching source data.
- `app/src/lib/range.ts` — `Range` model. Default view is rolling last 365 days; calendar years selectable via the minimap.
- `scripts/ingest/` — per-source fetchers, isolated; failures don't block other sources.
- `.github/workflows/ingest.yml` — cron every 6h. Stories live for 24h, so 6h gives 4 chances.
- `.github/workflows/refresh-ig-token.yml` — weekly, rotates the IG long-lived token.

See `docs/superpowers/specs/2026-05-08-life-contribution-graph-design.md` for the full design.
