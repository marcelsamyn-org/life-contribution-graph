# Life Contribution Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, static "life contribution graph" that aggregates Marcel's YouTube, Instagram, and GitHub contributions into an OKLCH-colored heatmap with a year minimap and rotating footer, ingested every 6h via GitHub Actions and deployed via Netlify.

**Architecture:** GitHub Actions cron → append-only `data/events.jsonl` (committed to repo) → Astro static site with one React island → Netlify static deploy. Per-source "blast radius" scoring lives in code (separate from source identity data) so it's tunable without touching data files.

**Tech Stack:** Bun (runtime + package manager + test runner), Astro 5 + React 19 (one interactive island), Tailwind 4 via `@tailwindcss/vite`, Zod 4 (runtime validation, discriminated union), `culori` (OKLCH interpolation), `date-fns-tz` (timezone-aware date formatting), Biome (lint + format), Netlify (deploy).

---

## Tasks Overview

1. Project scaffolding (bun, Astro, Tailwind, React, Biome, TS strict)
2. Data files seed (`data/sources.json`, empty `data/events.jsonl`)
3. Zod schemas (`app/src/lib/schema.ts`)
4. JSONL loader (`app/src/lib/load-events.ts`)
5. Blast functions (`app/src/lib/blast.ts`)
6. Compute pipeline (`app/src/lib/compute.ts`)
7. Color scale (`app/src/lib/color.ts`)
8. Facts (`app/src/lib/facts.ts`)
9. `Heatmap` component
10. `Minimap` component
11. `SourceToggles` component
12. `DayDrawer` component
13. `RotatingFooter` component
14. `Graph` root island + Astro page
15. Ingest helpers (timezone + http)
16. Persist (idempotent JSONL append)
17. YouTube ingester
18. Instagram ingester
19. GitHub ingester
20. `run.ts` orchestration
21. `ingest.yml` GitHub workflow
22. `refresh-ig-token.yml` GitHub workflow
23. `netlify.toml` + README + first deploy

---

## File Structure

```
life-contribution-graph/
├── app/
│   ├── astro.config.ts
│   └── src/
│       ├── pages/index.astro
│       ├── components/
│       │   ├── Graph.tsx
│       │   ├── Heatmap.tsx
│       │   ├── Minimap.tsx
│       │   ├── SourceToggles.tsx
│       │   ├── DayDrawer.tsx
│       │   └── RotatingFooter.tsx
│       ├── lib/
│       │   ├── schema.ts
│       │   ├── blast.ts
│       │   ├── compute.ts
│       │   ├── color.ts
│       │   ├── facts.ts
│       │   └── load-events.ts
│       └── styles/global.css
├── data/
│   ├── events.jsonl
│   └── sources.json
├── scripts/ingest/
│   ├── run.ts
│   ├── youtube.ts
│   ├── instagram.ts
│   ├── github.ts
│   ├── persist.ts
│   └── lib/
│       ├── timezone.ts
│       └── http.ts
├── tests/
│   ├── schema.test.ts
│   ├── load-events.test.ts
│   ├── blast.test.ts
│   ├── compute.test.ts
│   ├── color.test.ts
│   ├── facts.test.ts
│   ├── persist.test.ts
│   ├── youtube.test.ts
│   ├── instagram.test.ts
│   └── github.test.ts
├── tests/fixtures/
│   ├── youtube-uploads.json
│   ├── youtube-videos.json
│   ├── instagram-media.json
│   ├── instagram-stories.json
│   └── github-repos.json
├── .github/workflows/
│   ├── ingest.yml
│   └── refresh-ig-token.yml
├── netlify.toml
├── package.json
├── tsconfig.json
├── biome.json
├── .gitignore
└── README.md
```

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `biome.json`, `.gitignore`, `app/astro.config.ts`, `app/src/pages/index.astro`, `app/src/styles/global.css`

- [ ] **Step 1: Init bun project**

```bash
bun init -y
```

- [ ] **Step 2: Replace generated `package.json`**

```json
{
  "name": "life-contribution-graph",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "astro dev --root app",
    "build": "astro build --root app",
    "preview": "astro preview --root app",
    "check": "astro check --root app && tsc --noEmit",
    "lint": "biome check .",
    "format": "biome format --write .",
    "test": "bun test",
    "ingest": "bun run scripts/ingest/run.ts"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/react": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "zod": "^4.0.0",
    "culori": "^4.0.0",
    "date-fns": "^4.0.0",
    "date-fns-tz": "^3.0.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@types/bun": "latest",
    "@types/culori": "^2.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
bun install
```

Expected: lockfile created (`bun.lock`), `node_modules/` populated.

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "types": ["bun", "astro/client"],
    "baseUrl": ".",
    "paths": {
      "@app/*": ["app/src/*"],
      "@data/*": ["data/*"],
      "@scripts/*": ["scripts/*"]
    }
  },
  "include": ["app/src/**/*", "scripts/**/*", "tests/**/*"]
}
```

- [ ] **Step 5: Write `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "always" }
  },
  "files": {
    "ignore": ["node_modules", "app/dist", "data/events.jsonl"]
  }
}
```

- [ ] **Step 6: Write `.gitignore`**

```
node_modules/
app/dist/
.astro/
.netlify/
.env
.env.local
*.log
.DS_Store
```

- [ ] **Step 7: Write `app/astro.config.ts`**

```ts
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 8: Write `app/src/styles/global.css`**

```css
@import "tailwindcss";

:root {
  color-scheme: light;
}

html, body {
  background: oklch(0.98 0.005 90);
  color: oklch(0.18 0.01 250);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

- [ ] **Step 9: Write minimal `app/src/pages/index.astro`**

```astro
---
import '../styles/global.css';
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Marcel Samyn — life contribution graph</title>
  </head>
  <body class="min-h-screen flex items-center justify-center">
    <p class="text-sm opacity-60">scaffolding ok</p>
  </body>
</html>
```

- [ ] **Step 10: Verify build works**

```bash
bun run build
```

Expected: exits 0, prints "✓ build complete", `app/dist/index.html` exists.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "🔧 chore: scaffold bun + astro 5 + tailwind 4 + react 19 + biome"
```

---

## Task 2: Data files seed

**Files:**
- Create: `data/sources.json`, `data/events.jsonl`

- [ ] **Step 1: Write `data/sources.json`**

```json
[
  { "id": "youtube_long",    "label": "YouTube long-form",  "group": "video",   "defaultEnabled": true,  "color": "oklch(0.7 0.18 25)" },
  { "id": "youtube_short",   "label": "YouTube shorts",     "group": "video",   "defaultEnabled": true,  "color": "oklch(0.78 0.16 50)" },
  { "id": "ig_reel",         "label": "Instagram reels",    "group": "social",  "defaultEnabled": true,  "color": "oklch(0.7 0.16 320)" },
  { "id": "ig_post",         "label": "Instagram posts",    "group": "social",  "defaultEnabled": true,  "color": "oklch(0.72 0.14 290)" },
  { "id": "ig_story",        "label": "Instagram stories",  "group": "social",  "defaultEnabled": false, "color": "oklch(0.78 0.10 270)" },
  { "id": "book_commit",     "label": "Book",               "group": "writing", "defaultEnabled": true,  "color": "oklch(0.65 0.15 145)" },
  { "id": "gh_repo_created", "label": "New repos",          "group": "code",    "defaultEnabled": true,  "color": "oklch(0.6 0.18 220)" }
]
```

- [ ] **Step 2: Create empty `data/events.jsonl`**

```bash
touch data/events.jsonl
```

- [ ] **Step 3: Commit**

```bash
git add data/
git commit -m "✨ feat(data): seed sources.json with 7 sources, init empty events.jsonl"
```

---

## Task 3: Zod schemas

Defines the typed event union. The shape every other module trusts.

**Files:**
- Create: `app/src/lib/schema.ts`
- Test: `tests/schema.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/schema.test.ts`:

```ts
import { test, expect, describe } from 'bun:test';
import { Event, Source } from '../app/src/lib/schema';

describe('Event schema', () => {
  test('parses a youtube_long event', () => {
    const parsed = Event.parse({
      id: 'yt:abc',
      source: 'youtube_long',
      date: '2026-05-08',
      durationSec: 1380,
      title: 'On giving',
      url: 'https://youtu.be/abc',
    });
    expect(parsed.source).toBe('youtube_long');
    if (parsed.source === 'youtube_long') {
      expect(parsed.durationSec).toBe(1380);
    }
  });

  test('parses a youtube_short event', () => {
    const parsed = Event.parse({
      id: 'yt:xyz',
      source: 'youtube_short',
      date: '2026-05-08',
      durationSec: 47,
    });
    expect(parsed.source).toBe('youtube_short');
  });

  test('parses an ig_reel event', () => {
    const parsed = Event.parse({
      id: 'ig:reel:1',
      source: 'ig_reel',
      date: '2026-05-08',
      durationSec: 30,
    });
    expect(parsed.source).toBe('ig_reel');
  });

  test('parses an ig_post event', () => {
    const parsed = Event.parse({
      id: 'ig:post:1',
      source: 'ig_post',
      date: '2026-05-08',
    });
    expect(parsed.source).toBe('ig_post');
  });

  test('parses an ig_story event', () => {
    const parsed = Event.parse({
      id: 'ig:story:1',
      source: 'ig_story',
      date: '2026-05-08',
    });
    expect(parsed.source).toBe('ig_story');
  });

  test('parses a book_commit event', () => {
    const parsed = Event.parse({
      id: 'book:e7a',
      source: 'book_commit',
      date: '2026-05-08',
      linesAdded: 312,
      message: 'chapter 3 draft',
    });
    expect(parsed.source).toBe('book_commit');
    if (parsed.source === 'book_commit') {
      expect(parsed.linesAdded).toBe(312);
    }
  });

  test('parses a gh_repo_created event', () => {
    const parsed = Event.parse({
      id: 'gh:marcelsamyn/foo',
      source: 'gh_repo_created',
      date: '2026-05-08',
      name: 'foo',
      url: 'https://github.com/marcelsamyn/foo',
    });
    expect(parsed.source).toBe('gh_repo_created');
  });

  test('rejects unknown source', () => {
    expect(() =>
      Event.parse({ id: 'x', source: 'unknown', date: '2026-05-08' })
    ).toThrow();
  });

  test('rejects malformed date', () => {
    expect(() =>
      Event.parse({ id: 'x', source: 'ig_post', date: 'yesterday' })
    ).toThrow();
  });
});

describe('Source schema', () => {
  test('parses a source entry', () => {
    const parsed = Source.parse({
      id: 'youtube_long',
      label: 'YouTube long-form',
      group: 'video',
      defaultEnabled: true,
      color: 'oklch(0.7 0.18 25)',
    });
    expect(parsed.id).toBe('youtube_long');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/schema.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `app/src/lib/schema.ts`**

```ts
import { z } from 'zod';

export const SourceId = z.enum([
  'youtube_long',
  'youtube_short',
  'ig_reel',
  'ig_post',
  'ig_story',
  'book_commit',
  'gh_repo_created',
]);
export type SourceId = z.infer<typeof SourceId>;

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

const VideoEvent = z.object({
  id: z.string().min(1),
  source: z.enum(['youtube_long', 'youtube_short', 'ig_reel']),
  date: DateString,
  durationSec: z.number().int().nonnegative(),
  title: z.string().optional(),
  url: z.string().url().optional(),
});

const PostEvent = z.object({
  id: z.string().min(1),
  source: z.enum(['ig_post', 'ig_story']),
  date: DateString,
  url: z.string().url().optional(),
  caption: z.string().optional(),
});

const CommitEvent = z.object({
  id: z.string().min(1),
  source: z.literal('book_commit'),
  date: DateString,
  linesAdded: z.number().int().nonnegative(),
  message: z.string().optional(),
});

const RepoEvent = z.object({
  id: z.string().min(1),
  source: z.literal('gh_repo_created'),
  date: DateString,
  name: z.string(),
  url: z.string().url(),
});

export const Event = z.discriminatedUnion('source', [
  VideoEvent,
  PostEvent,
  CommitEvent,
  RepoEvent,
]);
export type Event = z.infer<typeof Event>;

export const Source = z.object({
  id: SourceId,
  label: z.string().min(1),
  group: z.enum(['video', 'social', 'writing', 'code']),
  defaultEnabled: z.boolean(),
  color: z.string().min(1),
});
export type Source = z.infer<typeof Source>;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/schema.test.ts
```

Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/schema.ts tests/schema.test.ts
git commit -m "✨ feat(schema): add Zod discriminated union for Event + Source"
```

---

## Task 4: JSONL loader

**Files:**
- Create: `app/src/lib/load-events.ts`
- Test: `tests/load-events.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/load-events.test.ts`:

```ts
import { test, expect, describe } from 'bun:test';
import { parseEventsJsonl, loadEvents } from '../app/src/lib/load-events';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('parseEventsJsonl', () => {
  test('returns empty array for empty string', () => {
    expect(parseEventsJsonl('')).toEqual([]);
  });

  test('skips blank lines', () => {
    expect(parseEventsJsonl('\n\n')).toEqual([]);
  });

  test('parses a single event', () => {
    const line = JSON.stringify({
      id: 'ig:1',
      source: 'ig_post',
      date: '2026-05-08',
    });
    expect(parseEventsJsonl(line)).toHaveLength(1);
  });

  test('parses multiple events separated by newlines', () => {
    const lines = [
      JSON.stringify({ id: 'a', source: 'ig_post', date: '2026-05-08' }),
      JSON.stringify({ id: 'b', source: 'ig_post', date: '2026-05-08' }),
    ].join('\n');
    expect(parseEventsJsonl(lines)).toHaveLength(2);
  });

  test('throws on invalid event', () => {
    const line = JSON.stringify({ id: 'x', source: 'nope', date: '2026-05-08' });
    expect(() => parseEventsJsonl(line)).toThrow();
  });

  test('throws on malformed JSON', () => {
    expect(() => parseEventsJsonl('{not json')).toThrow();
  });
});

describe('loadEvents', () => {
  test('returns empty array if file does not exist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lcg-'));
    const result = await loadEvents(join(dir, 'missing.jsonl'));
    expect(result).toEqual([]);
  });

  test('reads and parses an existing file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lcg-'));
    const path = join(dir, 'events.jsonl');
    writeFileSync(
      path,
      JSON.stringify({ id: 'a', source: 'ig_post', date: '2026-05-08' }) + '\n'
    );
    const result = await loadEvents(path);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/load-events.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `app/src/lib/load-events.ts`**

```ts
import { readFile } from 'node:fs/promises';
import { Event, type Event as EventT } from './schema';

export function parseEventsJsonl(text: string): EventT[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => Event.parse(JSON.parse(line)));
}

export async function loadEvents(path: string): Promise<EventT[]> {
  let text: string;
  try {
    text = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  return parseEventsJsonl(text);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/load-events.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/load-events.ts tests/load-events.test.ts
git commit -m "✨ feat(lib): add JSONL loader with Zod validation"
```

---

## Task 5: Blast functions

The scoring policy. Three primitives: `point`, `durationDays`, `linesCapped`. Each returns a `BlastFn`.

**Files:**
- Create: `app/src/lib/blast.ts`
- Test: `tests/blast.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/blast.test.ts`:

```ts
import { test, expect, describe } from 'bun:test';
import {
  point,
  durationDays,
  linesCapped,
  blastBySource,
} from '../app/src/lib/blast';
import type { Event } from '../app/src/lib/schema';

const reel: Event = {
  id: 'ig:r',
  source: 'ig_reel',
  date: '2026-05-08',
  durationSec: 30,
};

const longVideo30min: Event = {
  id: 'yt:long',
  source: 'youtube_long',
  date: '2026-05-08',
  durationSec: 30 * 60,
};

const longVideo70min: Event = {
  id: 'yt:long2',
  source: 'youtube_long',
  date: '2026-05-08',
  durationSec: 70 * 60,
};

const bookSmall: Event = {
  id: 'book:1',
  source: 'book_commit',
  date: '2026-05-08',
  linesAdded: 50,
};

const bookHuge: Event = {
  id: 'book:2',
  source: 'book_commit',
  date: '2026-05-08',
  linesAdded: 5000,
};

describe('point', () => {
  test('returns a single day with the given weight', () => {
    const result = point(1)(reel);
    expect(result).toEqual([{ date: '2026-05-08', intensity: 1 }]);
  });

  test('respects fractional weights', () => {
    const result = point(0.3)(reel);
    expect(result[0]?.intensity).toBeCloseTo(0.3);
  });
});

describe('durationDays', () => {
  test('30min video → 3 days, total intensity conserved', () => {
    const fn = durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'flat' });
    const days = fn(longVideo30min);
    expect(days).toHaveLength(3);
    const total = days.reduce((s, d) => s + d.intensity, 0);
    expect(total).toBeCloseTo(3);
  });

  test('70min video → capped at 7 days', () => {
    const fn = durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'flat' });
    const days = fn(longVideo70min);
    expect(days).toHaveLength(7);
  });

  test('spreads BACKWARD from post date', () => {
    const fn = durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'flat' });
    const days = fn(longVideo30min).map((d) => d.date);
    expect(days).toEqual(['2026-05-06', '2026-05-07', '2026-05-08']);
  });

  test('decay shape: post date is brightest, earlier days fade', () => {
    const fn = durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'decay' });
    const days = fn(longVideo30min);
    expect(days[0]!.intensity).toBeLessThan(days[2]!.intensity);
  });

  test('decay still conserves total intensity', () => {
    const fn = durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'decay' });
    const days = fn(longVideo30min);
    const total = days.reduce((s, d) => s + d.intensity, 0);
    expect(total).toBeCloseTo(3);
  });

  test('throws on non-video event', () => {
    const fn = durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'flat' });
    expect(() => fn(reel as never)).not.toThrow();
  });
});

describe('linesCapped', () => {
  test('uncapped: returns linesAdded as intensity', () => {
    const fn = linesCapped({ perLine: 1, cap: 200 });
    expect(fn(bookSmall)).toEqual([{ date: '2026-05-08', intensity: 50 }]);
  });

  test('caps at the configured maximum', () => {
    const fn = linesCapped({ perLine: 1, cap: 200 });
    expect(fn(bookHuge)).toEqual([{ date: '2026-05-08', intensity: 200 }]);
  });

  test('respects perLine multiplier', () => {
    const fn = linesCapped({ perLine: 0.5, cap: 1000 });
    expect(fn(bookSmall)[0]?.intensity).toBeCloseTo(25);
  });
});

describe('blastBySource defaults', () => {
  test('every source has a blast function', () => {
    const ids: Array<keyof typeof blastBySource> = [
      'youtube_long',
      'youtube_short',
      'ig_reel',
      'ig_post',
      'ig_story',
      'book_commit',
      'gh_repo_created',
    ];
    for (const id of ids) {
      expect(typeof blastBySource[id]).toBe('function');
    }
  });

  test('ig_story weight is 0.3', () => {
    const event: Event = {
      id: 'ig:s',
      source: 'ig_story',
      date: '2026-05-08',
    };
    expect(blastBySource.ig_story(event)[0]?.intensity).toBeCloseTo(0.3);
  });

  test('gh_repo_created weight is 5', () => {
    const event: Event = {
      id: 'gh:r',
      source: 'gh_repo_created',
      date: '2026-05-08',
      name: 'r',
      url: 'https://github.com/x/r',
    };
    expect(blastBySource.gh_repo_created(event)[0]?.intensity).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/blast.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `app/src/lib/blast.ts`**

```ts
import type { Event, SourceId } from './schema';

export type DayIntensity = { date: string; intensity: number };
export type BlastFn = (event: Event) => DayIntensity[];

function shiftDate(yyyymmdd: string, deltaDays: number): string {
  const [y, m, d] = yyyymmdd.split('-').map((s) => Number.parseInt(s, 10)) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  const iso = date.toISOString();
  return iso.slice(0, 10);
}

export function point(weight: number): BlastFn {
  return (event) => [{ date: event.date, intensity: weight }];
}

type DurationDaysOpts = {
  secondsPerDay: number;
  maxDays: number;
  shape: 'flat' | 'decay';
};

export function durationDays(opts: DurationDaysOpts): BlastFn {
  return (event) => {
    if (!('durationSec' in event)) return [];
    const rawDays = Math.max(1, Math.ceil(event.durationSec / opts.secondsPerDay));
    const days = Math.min(opts.maxDays, rawDays);
    const totalIntensity = days; // 1 unit per day, conservation
    const offsets = Array.from({ length: days }, (_, i) => -(days - 1 - i));

    if (opts.shape === 'flat') {
      const per = totalIntensity / days;
      return offsets.map((delta) => ({
        date: shiftDate(event.date, delta),
        intensity: per,
      }));
    }

    // 'decay': linear ramp, peak on post date, fading backward
    // weights are 1, 2, ..., days summing to days*(days+1)/2
    // we normalize so total = totalIntensity
    const triangleSum = (days * (days + 1)) / 2;
    return offsets.map((delta, i) => {
      const rawWeight = i + 1;
      const intensity = (rawWeight / triangleSum) * totalIntensity;
      return { date: shiftDate(event.date, delta), intensity };
    });
  };
}

type LinesCappedOpts = { perLine: number; cap: number };

export function linesCapped(opts: LinesCappedOpts): BlastFn {
  return (event) => {
    if (!('linesAdded' in event)) return [];
    const raw = event.linesAdded * opts.perLine;
    const intensity = Math.min(opts.cap, raw);
    return [{ date: event.date, intensity }];
  };
}

export const blastBySource: Record<SourceId, BlastFn> = {
  youtube_long: durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'decay' }),
  youtube_short: point(1),
  ig_reel: point(1),
  ig_post: point(1),
  ig_story: point(0.3),
  book_commit: linesCapped({ perLine: 1, cap: 200 }),
  gh_repo_created: point(5),
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/blast.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/blast.ts tests/blast.test.ts
git commit -m "✨ feat(blast): per-source scoring (point, durationDays, linesCapped)"
```

---

## Task 6: Compute pipeline

Events → enabled-source filter → blast-fan-out → daily totals → 53×7 grid for the year.

**Files:**
- Create: `app/src/lib/compute.ts`
- Test: `tests/compute.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/compute.test.ts`:

```ts
import { test, expect, describe } from 'bun:test';
import {
  filterEnabled,
  fanOut,
  groupByDay,
  yearGrid,
  type DayCell,
} from '../app/src/lib/compute';
import type { Event, SourceId } from '../app/src/lib/schema';
import { blastBySource } from '../app/src/lib/blast';

const events: Event[] = [
  { id: 'a', source: 'ig_post', date: '2026-05-08' },
  { id: 'b', source: 'ig_story', date: '2026-05-08' },
  { id: 'c', source: 'youtube_short', date: '2026-05-09', durationSec: 30 },
];

describe('filterEnabled', () => {
  test('keeps only events whose source is enabled', () => {
    const enabled = new Set<SourceId>(['ig_post', 'youtube_short']);
    const out = filterEnabled(events, enabled);
    expect(out.map((e) => e.id)).toEqual(['a', 'c']);
  });
});

describe('fanOut', () => {
  test('expands each event via its blast function', () => {
    const out = fanOut(events, blastBySource);
    // ig_post (point 1) + ig_story (point 0.3) on same day + yt_short (point 1) → 3 entries
    expect(out).toHaveLength(3);
  });
});

describe('groupByDay', () => {
  test('sums intensities per date', () => {
    const out = groupByDay(fanOut(events, blastBySource));
    expect(out.get('2026-05-08')).toBeCloseTo(1.3);
    expect(out.get('2026-05-09')).toBeCloseTo(1);
  });
});

describe('yearGrid', () => {
  test('returns 53 weeks × 7 days', () => {
    const totals = new Map<string, number>();
    const grid = yearGrid(2026, totals);
    expect(grid).toHaveLength(53);
    for (const week of grid) {
      expect(week).toHaveLength(7);
    }
  });

  test('places intensities on the right day', () => {
    const totals = new Map([['2026-05-08', 2.5]]); // a Friday
    const grid = yearGrid(2026, totals);
    const cells: DayCell[] = grid.flat().filter((c) => c !== null);
    const found = cells.find((c) => c?.date === '2026-05-08');
    expect(found?.intensity).toBe(2.5);
  });

  test('returns null for cells before Jan 1 / after Dec 31', () => {
    const grid = yearGrid(2026, new Map());
    // First column may have nulls before Jan 1; last column may have nulls after Dec 31
    const allCells = grid.flat();
    const nulls = allCells.filter((c) => c === null);
    expect(nulls.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/compute.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `app/src/lib/compute.ts`**

```ts
import type { Event, SourceId } from './schema';
import type { BlastFn, DayIntensity } from './blast';

export type DayCell = { date: string; intensity: number } | null;

export function filterEnabled(events: Event[], enabled: Set<SourceId>): Event[] {
  return events.filter((e) => enabled.has(e.source));
}

export function fanOut(
  events: Event[],
  blast: Record<SourceId, BlastFn>,
): DayIntensity[] {
  return events.flatMap((e) => blast[e.source](e));
}

export function groupByDay(intensities: DayIntensity[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const { date, intensity } of intensities) {
    out.set(date, (out.get(date) ?? 0) + intensity);
  }
  return out;
}

function fmtDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns a 53×7 grid (week-major). Week starts Sunday (column 0).
 * The grid spans the calendar year `year`. Cells outside that year are null.
 */
export function yearGrid(year: number, totals: Map<string, number>): DayCell[][] {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dec31 = new Date(Date.UTC(year, 11, 31));
  const startDow = jan1.getUTCDay(); // 0=Sun..6=Sat
  // Start grid on the Sunday on/before Jan 1.
  const gridStart = new Date(jan1);
  gridStart.setUTCDate(gridStart.getUTCDate() - startDow);

  const weeks: DayCell[][] = [];
  for (let w = 0; w < 53; w++) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(gridStart);
      cur.setUTCDate(gridStart.getUTCDate() + w * 7 + d);
      if (cur < jan1 || cur > dec31) {
        week.push(null);
      } else {
        const key = fmtDate(cur);
        week.push({ date: key, intensity: totals.get(key) ?? 0 });
      }
    }
    weeks.push(week);
  }
  return weeks;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/compute.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/compute.ts tests/compute.test.ts
git commit -m "✨ feat(compute): event→day pipeline + 53×7 yearGrid"
```

---

## Task 7: Color scale

OKLCH-interpolated quantile bucketing. 5 buckets, perceptually even.

**Files:**
- Create: `app/src/lib/color.ts`
- Test: `tests/color.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/color.test.ts`:

```ts
import { test, expect, describe } from 'bun:test';
import { quantileBuckets, bucketColor } from '../app/src/lib/color';

describe('quantileBuckets', () => {
  test('returns 4 cut points for 5 buckets', () => {
    const cuts = quantileBuckets([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(cuts).toHaveLength(4);
  });

  test('returns ascending cut points', () => {
    const cuts = quantileBuckets([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (let i = 1; i < cuts.length; i++) {
      expect(cuts[i]!).toBeGreaterThanOrEqual(cuts[i - 1]!);
    }
  });

  test('ignores zero values when computing quantiles', () => {
    // Quiet years: many zeros + a few real values.
    // The cut points should reflect the real distribution, not be pulled to 0.
    const cuts = quantileBuckets([0, 0, 0, 0, 0, 0, 0, 1, 5, 10]);
    expect(cuts[0]!).toBeGreaterThan(0);
  });

  test('returns all-zero cuts when all values are zero', () => {
    const cuts = quantileBuckets([0, 0, 0]);
    expect(cuts).toEqual([0, 0, 0, 0]);
  });
});

describe('bucketColor', () => {
  test('returns a hex string', () => {
    const color = bucketColor(0);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('different buckets produce different colors', () => {
    expect(bucketColor(0)).not.toBe(bucketColor(4));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/color.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `app/src/lib/color.ts`**

```ts
import { interpolate, formatHex } from 'culori';

const stops = [
  'oklch(0.96 0 0)',         // empty — soft paper
  'oklch(0.85 0.08 145)',
  'oklch(0.72 0.14 145)',
  'oklch(0.58 0.18 145)',
  'oklch(0.42 0.20 145)',    // p95+ — deep verdant
];

const interp = interpolate(stops, 'oklch');

export function bucketColor(bucket: 0 | 1 | 2 | 3 | 4): string {
  const hex = formatHex(interp(bucket / 4));
  return hex ?? '#ffffff';
}

/**
 * Returns 4 cut points splitting non-zero values into 5 buckets via p25/p50/p75/p95.
 * Zero values are excluded from the quantile computation so a quiet year with many
 * zero days still produces a meaningful intensity scale on the live days.
 */
export function quantileBuckets(values: number[]): [number, number, number, number] {
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return [0, 0, 0, 0];
  const q = (p: number): number => {
    const idx = (nonZero.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return nonZero[lo]!;
    const frac = idx - lo;
    return nonZero[lo]! + (nonZero[hi]! - nonZero[lo]!) * frac;
  };
  return [q(0.25), q(0.5), q(0.75), q(0.95)];
}

export function bucketFor(value: number, cuts: [number, number, number, number]): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0;
  if (value <= cuts[0]) return 1;
  if (value <= cuts[1]) return 2;
  if (value <= cuts[2]) return 3;
  return 4;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/color.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/color.ts tests/color.test.ts
git commit -m "✨ feat(color): OKLCH 5-bucket quantile scale, zero-aware"
```

---

## Task 8: Facts

Pure functions over `Event[]` and `year`, returning a string or `null`.

**Files:**
- Create: `app/src/lib/facts.ts`
- Test: `tests/facts.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/facts.test.ts`:

```ts
import { test, expect, describe } from 'bun:test';
import { facts } from '../app/src/lib/facts';
import type { Event } from '../app/src/lib/schema';

const events: Event[] = [
  { id: 'a', source: 'youtube_long', date: '2026-01-15', durationSec: 1800, title: 't' },
  { id: 'b', source: 'youtube_long', date: '2026-02-20', durationSec: 3600, title: 't' },
  { id: 'c', source: 'ig_reel', date: '2026-03-01', durationSec: 30 },
  { id: 'd', source: 'ig_post', date: '2026-03-02' },
  { id: 'e', source: 'ig_story', date: '2026-03-03' },
  { id: 'f', source: 'book_commit', date: '2026-04-01', linesAdded: 100 },
  { id: 'g', source: 'book_commit', date: '2026-04-02', linesAdded: 80 },
  { id: 'h', source: 'ig_post', date: '2025-12-30' }, // outside year
];

describe('facts', () => {
  test('there are at least 6 fact functions', () => {
    expect(facts.length).toBeGreaterThanOrEqual(6);
  });

  test('every fact returns a string or null when given valid input', () => {
    for (const fact of facts) {
      const out = fact(events, 2026);
      expect(out === null || typeof out === 'string').toBe(true);
    }
  });

  test('every fact returns null for an empty year', () => {
    for (const fact of facts) {
      expect(fact([], 2026)).toBeNull();
    }
  });

  test('count fact reports the in-year event count', () => {
    const countFact = facts[0]!;
    const text = countFact(events, 2026);
    expect(text).toContain('7'); // 7 events in 2026
  });

  test('long-form hours fact reports hours of long-form video', () => {
    const hoursFact = facts.find((f) => /hour/.test(f(events, 2026) ?? ''));
    expect(hoursFact).toBeDefined();
  });

  test('book days fact returns null when no book commits', () => {
    const noBook: Event[] = [{ id: 'x', source: 'ig_post', date: '2026-01-01' }];
    const bookFact = facts.find((f) => /book/.test(f(events, 2026) ?? ''));
    expect(bookFact).toBeDefined();
    expect(bookFact!(noBook, 2026)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/facts.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `app/src/lib/facts.ts`**

```ts
import type { Event } from './schema';

export type Fact = (events: Event[], year: number) => string | null;

const inYear = (events: Event[], year: number): Event[] =>
  events.filter((e) => e.date.startsWith(`${year}-`));

const fmt = (n: number): string => n.toLocaleString();

const countFact: Fact = (events, year) => {
  const inY = inYear(events, year);
  if (inY.length === 0) return null;
  return `${fmt(inY.length)} gifts this year`;
};

const longFormHoursFact: Fact = (events, year) => {
  const longs = inYear(events, year).filter((e) => e.source === 'youtube_long');
  if (longs.length === 0) return null;
  const totalSec = longs.reduce((s, e) => s + ('durationSec' in e ? e.durationSec : 0), 0);
  const hours = Math.round(totalSec / 3600);
  return `${hours} hours of long-form video`;
};

const bookDaysFact: Fact = (events, year) => {
  const days = new Set(
    inYear(events, year)
      .filter((e) => e.source === 'book_commit')
      .map((e) => e.date),
  );
  if (days.size === 0) return null;
  return `${days.size} days at the book this year`;
};

const longestPauseFact: Fact = (events, year) => {
  const dates = inYear(events, year)
    .map((e) => e.date)
    .sort();
  if (dates.length < 2) return null;
  let maxGap = 0;
  for (let i = 1; i < dates.length; i++) {
    const a = new Date(dates[i - 1]!);
    const b = new Date(dates[i]!);
    const gap = Math.round((b.getTime() - a.getTime()) / 86_400_000);
    if (gap > maxGap) maxGap = gap;
  }
  if (maxGap < 2) return null;
  return `your quietest stretch: ${maxGap} days`;
};

const breakdownFact: Fact = (events, year) => {
  const inY = inYear(events, year);
  if (inY.length === 0) return null;
  const reels = inY.filter((e) => e.source === 'ig_reel').length;
  const posts = inY.filter((e) => e.source === 'ig_post').length;
  const stories = inY.filter((e) => e.source === 'ig_story').length;
  if (reels + posts + stories === 0) return null;
  return `${fmt(reels)} reels, ${fmt(posts)} posts, ${fmt(stories)} stories`;
};

const firstEventFact: Fact = (events, year) => {
  const inY = inYear(events, year).map((e) => e.date).sort();
  const first = inY[0];
  if (!first) return null;
  return `first gift of the year: ${first}`;
};

export const facts: Fact[] = [
  countFact,
  longFormHoursFact,
  bookDaysFact,
  longestPauseFact,
  breakdownFact,
  firstEventFact,
];
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/facts.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/facts.ts tests/facts.test.ts
git commit -m "✨ feat(facts): rotating-footer fact functions"
```

---

## Task 9: Heatmap component

53×7 grid of squares, colored by quantile bucket. Hover/click handlers passed in via props (state lives in `Graph`).

**Files:**
- Create: `app/src/components/Heatmap.tsx`

- [ ] **Step 1: Write `app/src/components/Heatmap.tsx`**

```tsx
import { useMemo } from 'react';
import type { DayCell } from '../lib/compute';
import { quantileBuckets, bucketColor, bucketFor } from '../lib/color';

type Props = {
  grid: DayCell[][];
  onHover: (cell: DayCell) => void;
  onClick: (cell: DayCell) => void;
  selectedDate: string | null;
};

export function Heatmap({ grid, onHover, onClick, selectedDate }: Props) {
  const cuts = useMemo(() => {
    const values = grid.flat().map((c) => (c ? c.intensity : 0));
    return quantileBuckets(values);
  }, [grid]);

  return (
    <div className="grid grid-flow-col gap-[3px]" role="grid" aria-label="contribution heatmap">
      {grid.map((week, w) => (
        <div key={w} className="grid grid-rows-7 gap-[3px]" role="row">
          {week.map((cell, d) => {
            if (!cell) {
              return <div key={d} className="w-3 h-3" aria-hidden="true" />;
            }
            const bucket = bucketFor(cell.intensity, cuts);
            const color = cell.intensity > 0 ? bucketColor(bucket) : 'oklch(0.96 0 0)';
            const isSelected = selectedDate === cell.date;
            return (
              <button
                type="button"
                key={d}
                aria-label={`${cell.date}, intensity ${cell.intensity.toFixed(2)}`}
                className={`w-3 h-3 rounded-[2px] transition-shadow ${
                  isSelected ? 'ring-2 ring-offset-1 ring-stone-700' : ''
                }`}
                style={{ background: color }}
                onMouseEnter={() => onHover(cell)}
                onFocus={() => onHover(cell)}
                onClick={() => onClick(cell)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/Heatmap.tsx
git commit -m "✨ feat(ui): Heatmap component (53×7 grid, OKLCH bucket colors)"
```

---

## Task 10: Minimap component

One bar per year, full width. Click navigates the parent's selected year. Sparse year ticks.

**Files:**
- Create: `app/src/components/Minimap.tsx`

- [ ] **Step 1: Write `app/src/components/Minimap.tsx`**

```tsx
import { useMemo } from 'react';
import type { Event } from '../lib/schema';
import { bucketColor, bucketFor, quantileBuckets } from '../lib/color';
import { fanOut, filterEnabled, groupByDay } from '../lib/compute';
import { blastBySource } from '../lib/blast';
import type { SourceId } from '../lib/schema';

type Props = {
  events: Event[];
  enabled: Set<SourceId>;
  selectedYear: number;
  onSelectYear: (year: number) => void;
};

type YearStat = { year: number; total: number };

export function Minimap({ events, enabled, selectedYear, onSelectYear }: Props) {
  const stats: YearStat[] = useMemo(() => {
    const filtered = filterEnabled(events, enabled);
    const totals = groupByDay(fanOut(filtered, blastBySource));
    const byYear = new Map<number, number>();
    for (const [date, value] of totals) {
      const y = Number.parseInt(date.slice(0, 4), 10);
      byYear.set(y, (byYear.get(y) ?? 0) + value);
    }
    if (byYear.size === 0) return [];
    const years = [...byYear.keys()].sort();
    const first = years[0]!;
    const last = Math.max(years[years.length - 1]!, selectedYear);
    const out: YearStat[] = [];
    for (let y = first; y <= last; y++) {
      out.push({ year: y, total: byYear.get(y) ?? 0 });
    }
    return out;
  }, [events, enabled, selectedYear]);

  const max = useMemo(() => stats.reduce((m, s) => Math.max(m, s.total), 0) || 1, [stats]);
  const cuts = useMemo(() => quantileBuckets(stats.map((s) => s.total)), [stats]);

  if (stats.length === 0) return null;

  const labelEvery = Math.max(1, Math.ceil(stats.length / 8));

  return (
    <div className="w-full" aria-label="year minimap">
      <div className="flex items-end gap-1 h-12 w-full">
        {stats.map((s) => {
          const height = `${Math.max(4, (s.total / max) * 100)}%`;
          const bucket = bucketFor(s.total, cuts);
          const color = s.total > 0 ? bucketColor(bucket) : 'oklch(0.93 0 0)';
          const isActive = s.year === selectedYear;
          return (
            <button
              type="button"
              key={s.year}
              onClick={() => onSelectYear(s.year)}
              aria-label={`${s.year}, total ${s.total.toFixed(0)}`}
              className={`flex-1 rounded-sm transition-opacity ${
                isActive ? 'opacity-100 outline outline-1 outline-stone-700' : 'opacity-80 hover:opacity-100'
              }`}
              style={{ height, background: color }}
            />
          );
        })}
      </div>
      <div className="flex gap-1 mt-1 w-full text-[10px] tabular-nums opacity-60">
        {stats.map((s, i) => {
          const showLabel =
            s.year === selectedYear ||
            i === 0 ||
            i === stats.length - 1 ||
            i % labelEvery === 0;
          return (
            <div key={s.year} className="flex-1 text-center">
              {showLabel ? `'${String(s.year).slice(2)}` : ' '}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/Minimap.tsx
git commit -m "✨ feat(ui): Minimap year strip with click-to-navigate"
```

---

## Task 11: SourceToggles component

Source chips with checkboxes. Pure presentation; state owned by parent.

**Files:**
- Create: `app/src/components/SourceToggles.tsx`

- [ ] **Step 1: Write `app/src/components/SourceToggles.tsx`**

```tsx
import type { Source, SourceId } from '../lib/schema';

type Props = {
  sources: Source[];
  enabled: Set<SourceId>;
  onToggle: (id: SourceId) => void;
  onReset: () => void;
};

export function SourceToggles({ sources, enabled, onToggle, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {sources.map((s) => {
        const on = enabled.has(s.id);
        return (
          <button
            type="button"
            key={s.id}
            onClick={() => onToggle(s.id)}
            aria-pressed={on}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
              on
                ? 'border-stone-300 bg-white text-stone-900'
                : 'border-stone-200 bg-stone-50 text-stone-400'
            }`}
          >
            <span
              aria-hidden="true"
              className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
              style={{ background: on ? s.color : 'oklch(0.85 0 0)' }}
            />
            {s.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onReset}
        className="text-xs px-2 py-1 rounded-full text-stone-500 hover:text-stone-700"
      >
        reset
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/SourceToggles.tsx
git commit -m "✨ feat(ui): SourceToggles chip row"
```

---

## Task 12: DayDrawer component

Side panel listing the events of the selected day. Closes when `selectedDate` is null.

**Files:**
- Create: `app/src/components/DayDrawer.tsx`

- [ ] **Step 1: Write `app/src/components/DayDrawer.tsx`**

```tsx
import type { Event } from '../lib/schema';

type Props = {
  date: string | null;
  events: Event[];
  onClose: () => void;
};

function eventLabel(e: Event): string {
  switch (e.source) {
    case 'youtube_long':
      return `YouTube long-form${e.title ? ` — ${e.title}` : ''} (${Math.round(e.durationSec / 60)}m)`;
    case 'youtube_short':
      return `YouTube short${e.title ? ` — ${e.title}` : ''} (${e.durationSec}s)`;
    case 'ig_reel':
      return `Instagram reel (${e.durationSec}s)`;
    case 'ig_post':
      return `Instagram post${e.caption ? ` — ${e.caption.slice(0, 60)}` : ''}`;
    case 'ig_story':
      return 'Instagram story';
    case 'book_commit':
      return `Book commit — ${e.linesAdded} lines${e.message ? ` (${e.message.slice(0, 60)})` : ''}`;
    case 'gh_repo_created':
      return `New repo — ${e.name}`;
  }
}

function eventUrl(e: Event): string | undefined {
  if ('url' in e) return e.url;
  return undefined;
}

export function DayDrawer({ date, events, onClose }: Props) {
  if (!date) return null;
  const dayEvents = events.filter((e) => e.date === date);

  return (
    <aside
      className="fixed top-0 right-0 h-screen w-full max-w-sm bg-white border-l border-stone-200 shadow-xl p-6 overflow-y-auto"
      aria-label={`events on ${date}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium tabular-nums">{date}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="close"
          className="text-stone-500 hover:text-stone-900"
        >
          ×
        </button>
      </div>
      {dayEvents.length === 0 ? (
        <p className="text-sm text-stone-400">no gifts this day</p>
      ) : (
        <ul className="space-y-3">
          {dayEvents.map((e) => {
            const url = eventUrl(e);
            const label = eventLabel(e);
            return (
              <li key={e.id} className="text-sm">
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="underline decoration-stone-300 hover:decoration-stone-700">
                    {label}
                  </a>
                ) : (
                  label
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/DayDrawer.tsx
git commit -m "✨ feat(ui): DayDrawer with per-source labels and links"
```

---

## Task 13: RotatingFooter component

Letter-staggered crossfade between facts. Pauses when tab hidden.

**Files:**
- Create: `app/src/components/RotatingFooter.tsx`

- [ ] **Step 1: Write `app/src/components/RotatingFooter.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { Event } from '../lib/schema';
import { facts } from '../lib/facts';

const ROTATE_MS = 10_000;
const CHAR_DELAY_MS = 25;

type Props = {
  events: Event[];
  year: number;
};

export function RotatingFooter({ events, year }: Props) {
  const lines = useMemo(
    () => facts.map((f) => f(events, year)).filter((s): s is string => s !== null),
    [events, year],
  );
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (lines.length === 0) return;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (document.hidden) {
        timer = setTimeout(tick, ROTATE_MS);
        return;
      }
      setVisible(false);
      timer = setTimeout(() => {
        setI((cur) => (cur + 1) % lines.length);
        setVisible(true);
        timer = setTimeout(tick, ROTATE_MS);
      }, lines[0]!.length * CHAR_DELAY_MS + 200);
    };

    timer = setTimeout(tick, ROTATE_MS);
    return () => clearTimeout(timer);
  }, [lines]);

  if (lines.length === 0) return null;
  const current = lines[i] ?? '';

  return (
    <p
      className="text-sm text-stone-500 tabular-nums tracking-tight mt-6 min-h-5"
      aria-live="polite"
    >
      {[...current].map((ch, idx) => (
        <span
          key={`${i}-${idx}`}
          style={{
            transition: 'opacity 200ms ease',
            transitionDelay: `${idx * CHAR_DELAY_MS}ms`,
            opacity: visible ? 1 : 0,
            display: 'inline-block',
            whiteSpace: 'pre',
          }}
        >
          {ch}
        </span>
      ))}
    </p>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/RotatingFooter.tsx
git commit -m "✨ feat(ui): RotatingFooter with letter-staggered crossfade"
```

---

## Task 14: Graph root island + Astro page

Owns state: events, sources, enabled set (with localStorage + URL hash), selectedYear, selectedDate. Wires every other component together.

**Files:**
- Create: `app/src/components/Graph.tsx`
- Modify: `app/src/pages/index.astro`

- [ ] **Step 1: Write `app/src/components/Graph.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { Event, Source, SourceId } from '../lib/schema';
import { Heatmap } from './Heatmap';
import { Minimap } from './Minimap';
import { SourceToggles } from './SourceToggles';
import { DayDrawer } from './DayDrawer';
import { RotatingFooter } from './RotatingFooter';
import { blastBySource } from '../lib/blast';
import { fanOut, filterEnabled, groupByDay, yearGrid, type DayCell } from '../lib/compute';

type Props = {
  events: Event[];
  sources: Source[];
};

const STORAGE_KEY = 'lcg.enabled';

function defaultEnabled(sources: Source[]): Set<SourceId> {
  return new Set(sources.filter((s) => s.defaultEnabled).map((s) => s.id));
}

function loadEnabled(sources: Source[]): Set<SourceId> {
  if (typeof window === 'undefined') return defaultEnabled(sources);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const fromHash = hash.get('s');
  if (fromHash) {
    const ids = fromHash.split(',') as SourceId[];
    return new Set(ids.filter((id) => sources.some((s) => s.id === id)));
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const ids = JSON.parse(stored) as SourceId[];
      return new Set(ids);
    } catch {
      // fallthrough
    }
  }
  return defaultEnabled(sources);
}

export function Graph({ events, sources }: Props) {
  const allYears = useMemo(() => {
    const ys = new Set(events.map((e) => Number.parseInt(e.date.slice(0, 4), 10)));
    return [...ys].sort();
  }, [events]);

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const now = new Date().getUTCFullYear();
    return allYears.length > 0 ? (allYears.includes(now) ? now : allYears.at(-1)!) : now;
  });
  const [enabled, setEnabled] = useState<Set<SourceId>>(() => defaultEnabled(sources));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Hydrate enabled from URL hash + localStorage on mount.
  useEffect(() => {
    setEnabled(loadEnabled(sources));
  }, [sources]);

  // Persist enabled to localStorage + URL hash.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ids = [...enabled].sort();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    const hash = new URLSearchParams(window.location.hash.slice(1));
    hash.set('s', ids.join(','));
    window.history.replaceState(null, '', `#${hash.toString()}`);
  }, [enabled]);

  const totals = useMemo(() => {
    const filtered = filterEnabled(events, enabled);
    return groupByDay(fanOut(filtered, blastBySource));
  }, [events, enabled]);

  const grid: DayCell[][] = useMemo(
    () => yearGrid(selectedYear, totals),
    [selectedYear, totals],
  );

  const toggle = (id: SourceId) => {
    setEnabled((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => setEnabled(defaultEnabled(sources));

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-12">
      <header className="flex items-baseline justify-between mb-6">
        <h1 className="text-base font-medium">Marcel Samyn — life contribution graph</h1>
        <div className="flex items-center gap-2 text-sm tabular-nums">
          <button
            type="button"
            onClick={() => setSelectedYear((y) => y - 1)}
            aria-label="previous year"
            className="px-2 text-stone-500 hover:text-stone-900"
          >
            ◀
          </button>
          <span className="font-medium">{selectedYear}</span>
          <button
            type="button"
            onClick={() => setSelectedYear((y) => y + 1)}
            aria-label="next year"
            className="px-2 text-stone-500 hover:text-stone-900"
          >
            ▶
          </button>
        </div>
      </header>

      <SourceToggles
        sources={sources}
        enabled={enabled}
        onToggle={toggle}
        onReset={reset}
      />

      <Heatmap
        grid={grid}
        onHover={() => {/* tooltip handled later via state if desired */}}
        onClick={(cell) => cell && setSelectedDate(cell.date)}
        selectedDate={selectedDate}
      />

      <div className="mt-8">
        <Minimap
          events={events}
          enabled={enabled}
          selectedYear={selectedYear}
          onSelectYear={setSelectedYear}
        />
      </div>

      <RotatingFooter events={events} year={selectedYear} />

      <DayDrawer
        date={selectedDate}
        events={events}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Replace `app/src/pages/index.astro`**

```astro
---
import '../styles/global.css';
import { Graph } from '../components/Graph';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Event, Source } from '../lib/schema';
import { parseEventsJsonl } from '../lib/load-events';

const eventsPath = resolve(import.meta.dirname, '../../../data/events.jsonl');
const sourcesPath = resolve(import.meta.dirname, '../../../data/sources.json');

let eventsText = '';
try {
  eventsText = await readFile(eventsPath, 'utf-8');
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
}
const events = parseEventsJsonl(eventsText);
const sources = Source.array().parse(JSON.parse(await readFile(sourcesPath, 'utf-8')));
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Marcel Samyn — life contribution graph</title>
  </head>
  <body class="min-h-screen">
    <Graph events={events} sources={sources} client:load />
  </body>
</html>
```

- [ ] **Step 3: Type-check + build**

```bash
bun run check && bun run build
```

Expected: both succeed; `app/dist/index.html` produced.

- [ ] **Step 4: Manually verify the dev server**

```bash
bun run dev
```

Open `http://localhost:4321`. Expected: page renders with title, source toggles row, empty heatmap (Jan–Dec grid of empty squares for current year), no minimap (no events yet), no footer line. Then `Ctrl-C` to stop.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/Graph.tsx app/src/pages/index.astro
git commit -m "✨ feat(ui): Graph root island wires Heatmap + Minimap + Toggles + Drawer + Footer"
```

---

## Task 15: Ingest helpers (timezone + http)

**Files:**
- Create: `scripts/ingest/lib/timezone.ts`, `scripts/ingest/lib/http.ts`
- Test: `tests/timezone.test.ts`, `tests/http.test.ts`

- [ ] **Step 1: Write the failing timezone test**

`tests/timezone.test.ts`:

```ts
import { test, expect, describe } from 'bun:test';
import { toLocalDate, LOCAL_TZ } from '../scripts/ingest/lib/timezone';

describe('toLocalDate', () => {
  test('converts UTC ISO timestamp to YYYY-MM-DD in Marcel\'s TZ', () => {
    // 2026-05-08T22:00:00Z is 2026-05-09 00:00 in Brussels (CEST, UTC+2)
    expect(toLocalDate('2026-05-08T22:00:00Z')).toBe('2026-05-09');
  });

  test('keeps same date when already in business hours UTC', () => {
    expect(toLocalDate('2026-05-08T12:00:00Z')).toBe('2026-05-08');
  });

  test('handles winter offset (UTC+1, CET)', () => {
    expect(toLocalDate('2026-01-15T23:30:00Z')).toBe('2026-01-16');
  });

  test('default TZ is Europe/Brussels', () => {
    expect(LOCAL_TZ).toBe('Europe/Brussels');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/timezone.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `scripts/ingest/lib/timezone.ts`**

```ts
import { formatInTimeZone } from 'date-fns-tz';

export const LOCAL_TZ = process.env.LOCAL_TZ ?? 'Europe/Brussels';

export function toLocalDate(iso: string): string {
  return formatInTimeZone(new Date(iso), LOCAL_TZ, 'yyyy-MM-dd');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/timezone.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Write the failing http test**

`tests/http.test.ts`:

```ts
import { test, expect, describe, mock } from 'bun:test';
import { fetchJson } from '../scripts/ingest/lib/http';

describe('fetchJson', () => {
  test('returns parsed JSON for 2xx', async () => {
    const original = global.fetch;
    global.fetch = mock(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ) as typeof fetch;
    const result = await fetchJson<{ ok: boolean }>('https://example.com');
    expect(result.ok).toBe(true);
    global.fetch = original;
  });

  test('throws on non-2xx', async () => {
    const original = global.fetch;
    global.fetch = mock(async () =>
      new Response('boom', { status: 500 }),
    ) as typeof fetch;
    await expect(fetchJson('https://example.com')).rejects.toThrow(/500/);
    global.fetch = original;
  });

  test('retries on 5xx and succeeds', async () => {
    let n = 0;
    const original = global.fetch;
    global.fetch = mock(async () => {
      n++;
      if (n < 2) return new Response('boom', { status: 503 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    const result = await fetchJson<{ ok: boolean }>('https://example.com', { retries: 2, baseDelayMs: 1 });
    expect(result.ok).toBe(true);
    expect(n).toBe(2);
    global.fetch = original;
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
bun test tests/http.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Write `scripts/ingest/lib/http.ts`**

```ts
type FetchOpts = {
  retries?: number;
  baseDelayMs?: number;
  headers?: Record<string, string>;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.baseDelayMs ?? 500;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: opts.headers });
      if (res.status >= 500 && attempt < retries) {
        await sleep(baseDelay * 2 ** attempt);
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) throw err;
      await sleep(baseDelay * 2 ** attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetchJson failed');
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
bun test tests/http.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 9: Commit**

```bash
git add scripts/ingest/lib/ tests/timezone.test.ts tests/http.test.ts
git commit -m "✨ feat(ingest): timezone helper + retrying fetchJson"
```

---

## Task 16: Persist (idempotent JSONL append)

**Files:**
- Create: `scripts/ingest/persist.ts`
- Test: `tests/persist.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/persist.test.ts`:

```ts
import { test, expect, describe } from 'bun:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendNovelEvents } from '../scripts/ingest/persist';
import type { Event } from '../app/src/lib/schema';

const ev = (id: string, date = '2026-05-08'): Event => ({
  id,
  source: 'ig_post',
  date,
});

describe('appendNovelEvents', () => {
  test('writes all events to a fresh file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lcg-'));
    const path = join(dir, 'events.jsonl');
    const result = await appendNovelEvents(path, [ev('a'), ev('b')]);
    expect(result.appended).toBe(2);
    const lines = readFileSync(path, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  test('skips events with already-known ids', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lcg-'));
    const path = join(dir, 'events.jsonl');
    await appendNovelEvents(path, [ev('a'), ev('b')]);
    const result = await appendNovelEvents(path, [ev('a'), ev('c')]);
    expect(result.appended).toBe(1);
    const lines = readFileSync(path, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(3);
  });

  test('preserves canonical key order in serialized output', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lcg-'));
    const path = join(dir, 'events.jsonl');
    await appendNovelEvents(path, [ev('a')]);
    const line = readFileSync(path, 'utf-8').trim();
    expect(line.startsWith('{"id":"a"')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/persist.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `scripts/ingest/persist.ts`**

```ts
import { appendFile, readFile } from 'node:fs/promises';
import type { Event } from '../../app/src/lib/schema';

const KEY_ORDER = [
  'id',
  'source',
  'date',
  'durationSec',
  'linesAdded',
  'name',
  'title',
  'caption',
  'message',
  'url',
] as const;

function serialize(event: Event): string {
  const ordered: Record<string, unknown> = {};
  for (const key of KEY_ORDER) {
    if (key in event) ordered[key] = (event as Record<string, unknown>)[key];
  }
  for (const [k, v] of Object.entries(event)) {
    if (!(k in ordered)) ordered[k] = v;
  }
  return JSON.stringify(ordered);
}

export type PersistResult = { appended: number; skipped: number };

export async function appendNovelEvents(path: string, events: Event[]): Promise<PersistResult> {
  let existing = '';
  try {
    existing = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  const knownIds = new Set(
    existing
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try {
          return (JSON.parse(l) as { id: string }).id;
        } catch {
          return '';
        }
      })
      .filter(Boolean),
  );
  const novel = events.filter((e) => !knownIds.has(e.id));
  if (novel.length === 0) return { appended: 0, skipped: events.length };
  const text = `${novel.map(serialize).join('\n')}\n`;
  await appendFile(path, text);
  return { appended: novel.length, skipped: events.length - novel.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/persist.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest/persist.ts tests/persist.test.ts
git commit -m "✨ feat(ingest): idempotent JSONL append with canonical key order"
```

---

## Task 17: YouTube ingester

Pulls the uploads playlist, then `videos.list` for durations. Splits long-form vs short by `durationSec ≤ 180`.

**Files:**
- Create: `scripts/ingest/youtube.ts`, `tests/fixtures/youtube-playlist.json`, `tests/fixtures/youtube-videos.json`
- Test: `tests/youtube.test.ts`

- [ ] **Step 1: Write fixture `tests/fixtures/youtube-playlist.json`**

```json
{
  "items": [
    {
      "snippet": {
        "resourceId": { "videoId": "vid_long" },
        "publishedAt": "2026-05-08T12:00:00Z",
        "title": "On giving"
      }
    },
    {
      "snippet": {
        "resourceId": { "videoId": "vid_short" },
        "publishedAt": "2026-05-09T12:00:00Z",
        "title": "30s on Deida"
      }
    }
  ],
  "nextPageToken": null
}
```

- [ ] **Step 2: Write fixture `tests/fixtures/youtube-videos.json`**

```json
{
  "items": [
    { "id": "vid_long",  "contentDetails": { "duration": "PT23M" } },
    { "id": "vid_short", "contentDetails": { "duration": "PT47S" } }
  ]
}
```

- [ ] **Step 3: Write the failing test**

`tests/youtube.test.ts`:

```ts
import { test, expect, describe } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseIso8601Duration, classifyVideos } from '../scripts/ingest/youtube';

describe('parseIso8601Duration', () => {
  test('PT23M → 1380s', () => {
    expect(parseIso8601Duration('PT23M')).toBe(23 * 60);
  });
  test('PT47S → 47s', () => {
    expect(parseIso8601Duration('PT47S')).toBe(47);
  });
  test('PT1H30M → 5400s', () => {
    expect(parseIso8601Duration('PT1H30M')).toBe(90 * 60);
  });
  test('PT1H2M3S → 3723s', () => {
    expect(parseIso8601Duration('PT1H2M3S')).toBe(3723);
  });
});

describe('classifyVideos', () => {
  test('produces typed Events with correct source, splitting at 180s', async () => {
    const playlist = JSON.parse(
      await readFile(join('tests/fixtures/youtube-playlist.json'), 'utf-8'),
    );
    const videos = JSON.parse(
      await readFile(join('tests/fixtures/youtube-videos.json'), 'utf-8'),
    );
    const events = classifyVideos(playlist.items, videos.items);
    expect(events).toHaveLength(2);
    const long = events.find((e) => e.id === 'yt:vid_long');
    expect(long?.source).toBe('youtube_long');
    const short = events.find((e) => e.id === 'yt:vid_short');
    expect(short?.source).toBe('youtube_short');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
bun test tests/youtube.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Write `scripts/ingest/youtube.ts`**

```ts
import type { Event } from '../../app/src/lib/schema';
import { fetchJson } from './lib/http';
import { toLocalDate } from './lib/timezone';

const SHORT_THRESHOLD_SEC = 180;

type PlaylistItem = {
  snippet: {
    resourceId: { videoId: string };
    publishedAt: string;
    title: string;
  };
};

type VideoItem = {
  id: string;
  contentDetails: { duration: string };
};

export function parseIso8601Duration(d: string): number {
  // YouTube returns e.g. "PT1H2M3S"; H/M/S are optional.
  const m = d.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, h, mi, s] = m;
  return (Number(h ?? 0) * 3600) + (Number(mi ?? 0) * 60) + Number(s ?? 0);
}

export function classifyVideos(
  playlistItems: PlaylistItem[],
  videoItems: VideoItem[],
): Event[] {
  const durations = new Map(
    videoItems.map((v) => [v.id, parseIso8601Duration(v.contentDetails.duration)]),
  );
  return playlistItems.flatMap((item): Event[] => {
    const id = item.snippet.resourceId.videoId;
    const sec = durations.get(id);
    if (sec === undefined) return [];
    const source = sec <= SHORT_THRESHOLD_SEC ? 'youtube_short' : 'youtube_long';
    return [{
      id: `yt:${id}`,
      source,
      date: toLocalDate(item.snippet.publishedAt),
      durationSec: sec,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${id}`,
    }];
  });
}

async function fetchUploadsPlaylistId(channelId: string, apiKey: string): Promise<string> {
  type Resp = { items: { contentDetails: { relatedPlaylists: { uploads: string } } }[] };
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
  const data = await fetchJson<Resp>(url);
  const id = data.items[0]?.contentDetails.relatedPlaylists.uploads;
  if (!id) throw new Error(`no uploads playlist for channel ${channelId}`);
  return id;
}

async function fetchAllPlaylistItems(playlistId: string, apiKey: string): Promise<PlaylistItem[]> {
  type Resp = { items: PlaylistItem[]; nextPageToken?: string };
  const out: PlaylistItem[] = [];
  let pageToken: string | undefined;
  do {
    const url =
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}` +
      `&maxResults=50&key=${apiKey}` + (pageToken ? `&pageToken=${pageToken}` : '');
    const data = await fetchJson<Resp>(url);
    out.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

async function fetchVideoDurations(ids: string[], apiKey: string): Promise<VideoItem[]> {
  type Resp = { items: VideoItem[] };
  const out: VideoItem[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch.join(',')}&key=${apiKey}`;
    const data = await fetchJson<Resp>(url);
    out.push(...data.items);
  }
  return out;
}

export async function fetchYoutubeEvents(): Promise<Event[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!apiKey || !channelId) {
    throw new Error('YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID env vars are required');
  }
  const uploadsId = await fetchUploadsPlaylistId(channelId, apiKey);
  const items = await fetchAllPlaylistItems(uploadsId, apiKey);
  const videoIds = items.map((i) => i.snippet.resourceId.videoId);
  const videos = await fetchVideoDurations(videoIds, apiKey);
  return classifyVideos(items, videos);
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
bun test tests/youtube.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/ingest/youtube.ts tests/youtube.test.ts tests/fixtures/youtube-*.json
git commit -m "✨ feat(ingest): YouTube uploads + duration-based shorts split (≤180s)"
```

---

## Task 18: Instagram ingester

Pulls media (posts + reels) and stories from Graph API. Reels distinguished by `media_product_type=REELS`.

**Files:**
- Create: `scripts/ingest/instagram.ts`, `tests/fixtures/instagram-media.json`, `tests/fixtures/instagram-stories.json`
- Test: `tests/instagram.test.ts`

- [ ] **Step 1: Write fixture `tests/fixtures/instagram-media.json`**

```json
{
  "data": [
    { "id": "111", "media_type": "VIDEO",        "media_product_type": "REELS", "timestamp": "2026-05-08T18:00:00+0000", "permalink": "https://instagram.com/reel/111", "caption": "reel caption" },
    { "id": "222", "media_type": "IMAGE",        "media_product_type": "FEED",  "timestamp": "2026-05-07T20:30:00+0000", "permalink": "https://instagram.com/p/222",   "caption": "post caption" },
    { "id": "333", "media_type": "CAROUSEL_ALBUM","media_product_type": "FEED", "timestamp": "2026-05-06T09:00:00+0000", "permalink": "https://instagram.com/p/333" }
  ],
  "paging": { "next": null }
}
```

- [ ] **Step 2: Write fixture `tests/fixtures/instagram-stories.json`**

```json
{
  "data": [
    { "id": "story_a", "timestamp": "2026-05-08T22:00:00+0000", "permalink": "https://instagram.com/stories/marcelsamyn/story_a" }
  ]
}
```

- [ ] **Step 3: Write the failing test**

`tests/instagram.test.ts`:

```ts
import { test, expect, describe } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { mediaToEvents, storiesToEvents } from '../scripts/ingest/instagram';

describe('mediaToEvents', () => {
  test('classifies REELS as ig_reel and FEED as ig_post', async () => {
    const data = JSON.parse(
      await readFile('tests/fixtures/instagram-media.json', 'utf-8'),
    );
    const events = mediaToEvents(data.data);
    const byId = new Map(events.map((e) => [e.id, e]));
    expect(byId.get('ig:111')?.source).toBe('ig_reel');
    expect(byId.get('ig:222')?.source).toBe('ig_post');
    expect(byId.get('ig:333')?.source).toBe('ig_post');
  });
});

describe('storiesToEvents', () => {
  test('classifies stories as ig_story', async () => {
    const data = JSON.parse(
      await readFile('tests/fixtures/instagram-stories.json', 'utf-8'),
    );
    const events = storiesToEvents(data.data);
    expect(events).toHaveLength(1);
    expect(events[0]?.source).toBe('ig_story');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
bun test tests/instagram.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Write `scripts/ingest/instagram.ts`**

```ts
import type { Event } from '../../app/src/lib/schema';
import { fetchJson } from './lib/http';
import { toLocalDate } from './lib/timezone';

type Media = {
  id: string;
  media_type: 'VIDEO' | 'IMAGE' | 'CAROUSEL_ALBUM';
  media_product_type: 'REELS' | 'FEED';
  timestamp: string;
  permalink: string;
  caption?: string;
};

type Story = {
  id: string;
  timestamp: string;
  permalink: string;
};

export function mediaToEvents(items: Media[]): Event[] {
  return items.map((m): Event => {
    if (m.media_product_type === 'REELS') {
      return {
        id: `ig:${m.id}`,
        source: 'ig_reel',
        date: toLocalDate(m.timestamp),
        durationSec: 0,
        url: m.permalink,
      };
    }
    return {
      id: `ig:${m.id}`,
      source: 'ig_post',
      date: toLocalDate(m.timestamp),
      url: m.permalink,
      caption: m.caption,
    };
  });
}

export function storiesToEvents(items: Story[]): Event[] {
  return items.map((s): Event => ({
    id: `ig:story:${s.id}`,
    source: 'ig_story',
    date: toLocalDate(s.timestamp),
    url: s.permalink,
  }));
}

async function fetchAllMedia(userId: string, token: string): Promise<Media[]> {
  type Resp = { data: Media[]; paging?: { next?: string } };
  const fields = 'id,media_type,media_product_type,timestamp,permalink,caption';
  let url: string | undefined =
    `https://graph.instagram.com/v22.0/${userId}/media?fields=${fields}&access_token=${token}`;
  const out: Media[] = [];
  while (url) {
    const data = await fetchJson<Resp>(url);
    out.push(...data.data);
    url = data.paging?.next;
  }
  return out;
}

async function fetchStories(userId: string, token: string): Promise<Story[]> {
  type Resp = { data: Story[] };
  const url =
    `https://graph.instagram.com/v22.0/${userId}/stories?fields=id,timestamp,permalink&access_token=${token}`;
  const data = await fetchJson<Resp>(url);
  return data.data;
}

export async function fetchInstagramEvents(): Promise<Event[]> {
  const userId = process.env.IG_USER_ID;
  const token = process.env.IG_LONG_LIVED_TOKEN;
  if (!userId || !token) {
    throw new Error('IG_USER_ID and IG_LONG_LIVED_TOKEN env vars are required');
  }
  const [media, stories] = await Promise.all([
    fetchAllMedia(userId, token),
    fetchStories(userId, token),
  ]);
  return [...mediaToEvents(media), ...storiesToEvents(stories)];
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
bun test tests/instagram.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/ingest/instagram.ts tests/instagram.test.ts tests/fixtures/instagram-*.json
git commit -m "✨ feat(ingest): Instagram media + stories via Graph API v22"
```

---

## Task 19: GitHub ingester

`book_commit` events from cloning the book repo and parsing `git log --shortstat`. `gh_repo_created` events from the repos endpoint.

**Files:**
- Create: `scripts/ingest/github.ts`, `tests/fixtures/git-shortstat.txt`, `tests/fixtures/github-repos.json`
- Test: `tests/github.test.ts`

- [ ] **Step 1: Write fixture `tests/fixtures/git-shortstat.txt`**

```
commit e7a91f2c0d6b4e8f1234567890abcdef12345678
Author: Marcel Samyn <marcel@samyn.co>
Date:   2026-05-08T14:32:11+02:00

    chapter 3 draft

 3 files changed, 312 insertions(+), 18 deletions(-)

commit 1234567890abcdef1234567890abcdef12345678
Author: Marcel Samyn <marcel@samyn.co>
Date:   2026-05-07T19:00:00+02:00

    fix typos

 1 file changed, 5 insertions(+), 2 deletions(-)
```

- [ ] **Step 2: Write fixture `tests/fixtures/github-repos.json`**

```json
[
  { "name": "book", "html_url": "https://github.com/marcelsamyn-org/book", "created_at": "2025-09-01T10:00:00Z", "private": false },
  { "name": "life-contribution-graph", "html_url": "https://github.com/marcelsamyn/life-contribution-graph", "created_at": "2026-05-09T08:00:00Z", "private": false }
]
```

- [ ] **Step 3: Write the failing test**

`tests/github.test.ts`:

```ts
import { test, expect, describe } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parseGitShortstat, reposToEvents } from '../scripts/ingest/github';

describe('parseGitShortstat', () => {
  test('extracts commits with linesAdded and message', async () => {
    const text = await readFile('tests/fixtures/git-shortstat.txt', 'utf-8');
    const events = parseGitShortstat(text);
    expect(events).toHaveLength(2);
    const draft = events.find((e) => e.id === 'book:e7a91f2c0d6b4e8f1234567890abcdef12345678');
    expect(draft?.source).toBe('book_commit');
    if (draft?.source === 'book_commit') {
      expect(draft.linesAdded).toBe(312);
      expect(draft.message).toBe('chapter 3 draft');
    }
  });
});

describe('reposToEvents', () => {
  test('produces a gh_repo_created per public repo', async () => {
    const repos = JSON.parse(await readFile('tests/fixtures/github-repos.json', 'utf-8'));
    const events = reposToEvents(repos);
    expect(events).toHaveLength(2);
    expect(events[0]?.source).toBe('gh_repo_created');
  });

  test('skips private repos', () => {
    const events = reposToEvents([
      { name: 'secret', html_url: 'https://github.com/x/secret', created_at: '2026-01-01T00:00:00Z', private: true },
    ]);
    expect(events).toEqual([]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
bun test tests/github.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Write `scripts/ingest/github.ts`**

```ts
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Event } from '../../app/src/lib/schema';
import { fetchJson } from './lib/http';
import { toLocalDate } from './lib/timezone';

const exec = promisify(execFile);

type RepoApi = { name: string; html_url: string; created_at: string; private: boolean };

export function reposToEvents(repos: RepoApi[]): Event[] {
  return repos
    .filter((r) => !r.private)
    .map((r): Event => ({
      id: `gh:${new URL(r.html_url).pathname.slice(1)}`,
      source: 'gh_repo_created',
      date: toLocalDate(r.created_at),
      name: r.name,
      url: r.html_url,
    }));
}

export function parseGitShortstat(text: string): Event[] {
  const events: Event[] = [];
  const blocks = text.split(/^commit /m).filter(Boolean);
  for (const block of blocks) {
    const sha = block.split('\n', 1)[0]?.trim();
    if (!sha) continue;
    const dateMatch = block.match(/^Date:\s+(.+)$/m);
    const messageMatch = block.match(/\n\n\s{4}(.+)\n/);
    const insertMatch = block.match(/(\d+) insertion/);
    if (!dateMatch || !insertMatch) continue;
    const linesAdded = Number.parseInt(insertMatch[1]!, 10);
    events.push({
      id: `book:${sha}`,
      source: 'book_commit',
      date: toLocalDate(new Date(dateMatch[1]!).toISOString()),
      linesAdded,
      message: messageMatch?.[1]?.trim(),
    });
  }
  return events;
}

async function fetchBookCommits(): Promise<Event[]> {
  const repoUrl = 'https://github.com/marcelsamyn-org/book.git';
  const author = process.env.GH_BOOK_AUTHOR ?? 'Marcel Samyn';
  const dir = await mkdtemp(join(tmpdir(), 'lcg-book-'));
  try {
    await exec('git', ['clone', '--filter=blob:none', '--no-checkout', repoUrl, dir]);
    const { stdout } = await exec(
      'git',
      ['-C', dir, 'log', '--shortstat', '--date=iso-strict', `--author=${author}`, '--all'],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    return parseGitShortstat(stdout);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function fetchUserRepos(user: string, token: string | undefined): Promise<Event[]> {
  type Resp = RepoApi[];
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'life-contribution-graph',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const out: RepoApi[] = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/users/${user}/repos?per_page=100&page=${page}&type=owner&sort=created`;
    const batch = await fetchJson<Resp>(url, { headers });
    out.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return reposToEvents(out);
}

export async function fetchGithubEvents(): Promise<Event[]> {
  const token = process.env.GH_INGEST_PAT; // optional for public repos
  const [bookCommits, marcelRepos, orgRepos] = await Promise.all([
    fetchBookCommits(),
    fetchUserRepos('marcelsamyn', token),
    fetchUserRepos('marcelsamyn-org', token),
  ]);
  return [...bookCommits, ...marcelRepos, ...orgRepos];
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
bun test tests/github.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/ingest/github.ts tests/github.test.ts tests/fixtures/git-shortstat.txt tests/fixtures/github-repos.json
git commit -m "✨ feat(ingest): GitHub book commits via shallow clone + new repos via API"
```

---

## Task 20: `run.ts` orchestration

Per-source isolation: each source's failure is logged and does not block others. Persists novel events idempotently. Emits a one-line summary used as the commit message.

**Files:**
- Create: `scripts/ingest/run.ts`

- [ ] **Step 1: Write `scripts/ingest/run.ts`**

```ts
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import type { Event } from '../../app/src/lib/schema';
import { fetchYoutubeEvents } from './youtube';
import { fetchInstagramEvents } from './instagram';
import { fetchGithubEvents } from './github';
import { appendNovelEvents } from './persist';

type SourceRun = { name: string; events: Event[]; error?: string };

async function tryFetch(name: string, fn: () => Promise<Event[]>): Promise<SourceRun> {
  try {
    const events = await fn();
    return { name, events };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${name}] failed:`, message);
    return { name, events: [], error: message };
  }
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const dataPath = resolve(here, '../../data/events.jsonl');

  const runs = await Promise.all([
    tryFetch('youtube', fetchYoutubeEvents),
    tryFetch('instagram', fetchInstagramEvents),
    tryFetch('github', fetchGithubEvents),
  ]);

  const allEvents = runs.flatMap((r) => r.events);
  const result = await appendNovelEvents(dataPath, allEvents);

  // Per-source novelty count (after global dedupe).
  const summaryParts: string[] = [];
  for (const r of runs) {
    const count = r.events.length;
    const tag = r.error ? `${r.name}:err` : `${r.name}:${count}`;
    summaryParts.push(tag);
  }
  const summary = `📊 +${result.appended} (${summaryParts.join(' ')})`;

  console.log(summary);

  // Emit machine-readable summary for the workflow to read.
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `appended=${result.appended}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `summary<<EOF\n${summary}\nEOF\n`);
  }

  // Exit non-zero only if every source failed.
  const allFailed = runs.every((r) => r.error !== undefined);
  if (allFailed) process.exit(1);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify it type-checks**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/ingest/run.ts
git commit -m "✨ feat(ingest): orchestrator with per-source isolation and summary line"
```

---

## Task 21: `ingest.yml` GitHub workflow

Cron every 6h. Runs the orchestrator; commits + pushes if new events were appended.

**Files:**
- Create: `.github/workflows/ingest.yml`

- [ ] **Step 1: Write `.github/workflows/ingest.yml`**

```yaml
name: ingest

on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: ingest
  cancel-in-progress: false

jobs:
  run:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install deps
        run: bun install --frozen-lockfile

      - name: Run ingest
        id: ingest
        env:
          YOUTUBE_API_KEY: ${{ secrets.YOUTUBE_API_KEY }}
          YOUTUBE_CHANNEL_ID: ${{ secrets.YOUTUBE_CHANNEL_ID }}
          IG_USER_ID: ${{ secrets.IG_USER_ID }}
          IG_LONG_LIVED_TOKEN: ${{ secrets.IG_LONG_LIVED_TOKEN }}
          GH_INGEST_PAT: ${{ secrets.GH_INGEST_PAT }}
          LOCAL_TZ: Europe/Brussels
        run: bun run ingest

      - name: Commit changes
        if: steps.ingest.outputs.appended != '0' && steps.ingest.outputs.appended != ''
        run: |
          git config user.name 'lcg-ingest[bot]'
          git config user.email 'lcg-ingest@users.noreply.github.com'
          git add data/events.jsonl
          git diff --cached --quiet || git commit -m "${{ steps.ingest.outputs.summary }}"
          git push
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ingest.yml
git commit -m "🚀 ci: ingest workflow (every 6h, isolated sources, auto-commit)"
```

---

## Task 22: `refresh-ig-token.yml` GitHub workflow

Weekly. Calls Instagram's refresh endpoint and writes the rotated token back via `gh secret set`.

**Files:**
- Create: `.github/workflows/refresh-ig-token.yml`, `scripts/ingest/refresh-ig-token.ts`

- [ ] **Step 1: Write `scripts/ingest/refresh-ig-token.ts`**

```ts
import { fetchJson } from './lib/http';
import { execFileSync } from 'node:child_process';

type RefreshResp = { access_token: string; expires_in: number };

async function main(): Promise<void> {
  const token = process.env.IG_LONG_LIVED_TOKEN;
  if (!token) throw new Error('IG_LONG_LIVED_TOKEN not set');
  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`;
  const data = await fetchJson<RefreshResp>(url);
  if (!data.access_token) throw new Error('refresh did not return a token');

  // Write the rotated token back as the repo secret.
  // gh CLI is preinstalled on GitHub-hosted runners.
  execFileSync('gh', ['secret', 'set', 'IG_LONG_LIVED_TOKEN', '--body', data.access_token], {
    stdio: 'inherit',
    env: { ...process.env, GH_TOKEN: process.env.GH_PAT_FOR_SECRETS ?? process.env.GITHUB_TOKEN },
  });

  console.log(`refreshed; expires_in=${data.expires_in}s`);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Write `.github/workflows/refresh-ig-token.yml`**

```yaml
name: refresh-ig-token

on:
  schedule:
    - cron: '0 6 * * 0'  # weekly, Sunday 06:00 UTC
  workflow_dispatch:

permissions:
  contents: read

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install deps
        run: bun install --frozen-lockfile

      - name: Refresh and rotate
        env:
          IG_LONG_LIVED_TOKEN: ${{ secrets.IG_LONG_LIVED_TOKEN }}
          GH_PAT_FOR_SECRETS: ${{ secrets.GH_PAT_FOR_SECRETS }}
        run: bun run scripts/ingest/refresh-ig-token.ts
```

> **Operator note:** `GH_PAT_FOR_SECRETS` is a fine-grained PAT scoped to this single repo with `Secrets: Read & write` permission. Without it, `gh secret set` cannot write secrets (the default `GITHUB_TOKEN` lacks that scope).

- [ ] **Step 3: Commit**

```bash
git add scripts/ingest/refresh-ig-token.ts .github/workflows/refresh-ig-token.yml
git commit -m "🚀 ci: weekly Instagram long-lived token refresh + rotation"
```

---

## Task 23: `netlify.toml` + README + first deploy

**Files:**
- Create: `netlify.toml`, `README.md`

- [ ] **Step 1: Write `netlify.toml`**

```toml
[build]
  base = "."
  command = "bun install --frozen-lockfile && bun run build"
  publish = "app/dist"

[build.environment]
  NODE_VERSION = "20"
  BUN_VERSION = "1.2.0"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

- [ ] **Step 2: Write `README.md`**

```markdown
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
- `scripts/ingest/` — per-source fetchers, isolated; failures don't block other sources.
- `.github/workflows/ingest.yml` — cron every 6h. Stories live for 24h, so 6h gives 4 chances.
- `.github/workflows/refresh-ig-token.yml` — weekly, rotates the IG long-lived token.

See `docs/superpowers/specs/2026-05-08-life-contribution-graph-design.md` for the full design.
```

- [ ] **Step 3: Run the full suite**

```bash
bun test && bun run check && bun run build
```

Expected: all tests pass, type-check clean, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add netlify.toml README.md
git commit -m "🚀 chore: Netlify config + README"
```

- [ ] **Step 5: Push to GitHub and connect Netlify (manual)**

The remaining steps require Marcel's hands:

1. Create a GitHub repo at `marcelsamyn/life-contribution-graph`.
2. `git remote add origin git@github.com:marcelsamyn/life-contribution-graph.git && git push -u origin main`.
3. Netlify: New site → Import from GitHub → select repo. Build command and publish dir auto-detected from `netlify.toml`. Deploy.
4. Configure repo Actions secrets:
   - `YOUTUBE_API_KEY` (Google Cloud Console → YouTube Data API v3)
   - `YOUTUBE_CHANNEL_ID` (Marcel's channel)
   - `IG_USER_ID` (from Meta Business → Instagram account)
   - `IG_LONG_LIVED_TOKEN` (initial 60-day token from Meta Graph API explorer)
   - `META_APP_ID`, `META_APP_SECRET` (Meta App)
   - `GH_INGEST_PAT` (optional, only if hitting org-private repos)
   - `GH_PAT_FOR_SECRETS` (fine-grained PAT, this repo only, Secrets: Read & write)
5. Trigger `ingest.yml` manually via `Actions → ingest → Run workflow` for the first ingest.

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Architecture (GH Actions → JSONL → Astro → Netlify) — Tasks 1, 14, 21, 23
- ✅ JSONL events + sources.json identity split — Tasks 2, 3
- ✅ Blast radius separated from source data — Tasks 5, 8 (file paths confirm separation)
- ✅ OKLCH quantile color scale, 5 buckets, zero-aware — Task 7
- ✅ Heatmap + minimap + toggles + drawer + rotating footer — Tasks 9–14
- ✅ YouTube shorts ≤180s — Task 17
- ✅ Per-source ingestion isolation — Task 20
- ✅ Cron every 6h, idempotent persist — Tasks 16, 21
- ✅ IG token rotation — Task 22
- ✅ Netlify deploy — Task 23
- ✅ No streaks/leaderboards/goals (anti-features) — confirmed by absence in UI tasks

**Type consistency check:**
- `Event` discriminated union (Task 3) is referenced consistently across compute, blast, facts, ingestion.
- `SourceId` enum used in `Source`, `enabled` set, `blastBySource` keys.
- `DayCell` and `DayIntensity` types stable from Tasks 5/6 onward.
- Function names: `fanOut`, `groupByDay`, `yearGrid`, `appendNovelEvents`, `parseEventsJsonl` referenced identically wherever they appear.

**Placeholder scan:** none.

**Scope check:** Single coherent project, ~23 tasks. Plan is at the upper end of single-plan scope but cohesive — no independent subsystems to split.
