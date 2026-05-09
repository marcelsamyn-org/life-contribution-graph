import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Event } from '../../app/src/lib/schema';
import { fetchGithubEvents } from './github';
import { fetchInstagramEvents } from './instagram';
import { appendNovelEvents } from './persist';
import { fetchYoutubeEvents } from './youtube';

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

  const summaryParts: string[] = runs.map((r) =>
    r.error ? `${r.name}:err` : `${r.name}:${r.events.length}`,
  );
  const summary = `📊 +${result.appended} (${summaryParts.join(' ')})`;

  console.log(summary);

  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `appended=${result.appended}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `summary<<EOF\n${summary}\nEOF\n`);
  }

  const allFailed = runs.every((r) => r.error !== undefined);
  if (allFailed) process.exit(1);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
