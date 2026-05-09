import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { Event } from '../../app/src/lib/schema';
import { appendNovelEvents } from './persist';
import { toLocalDate } from './lib/timezone';

const ArchiveStory = z.object({
  uri: z.string().min(1),
  creation_timestamp: z.number().int().positive(),
  title: z.string().optional(),
});

const ArchiveFile = z.object({
  ig_stories: z.array(ArchiveStory),
});

const ID_FROM_URI = /([^/]+)\.[a-z0-9]+$/i;

export function archiveToEvents(items: z.infer<typeof ArchiveStory>[]): Event[] {
  return items.flatMap((s): Event[] => {
    const match = s.uri.match(ID_FROM_URI);
    if (!match) return [];
    const id = match[1];
    return [
      {
        id: `ig:story:${id}`,
        source: 'ig_story',
        date: toLocalDate(new Date(s.creation_timestamp * 1000).toISOString()),
        caption: s.title,
      },
    ];
  });
}

async function main(): Promise<void> {
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error('usage: bun run scripts/ingest/instagram-archive.ts <path-to-stories.json>');
    process.exit(1);
  }
  const inputPath = resolve(process.cwd(), inputArg);
  const raw = await readFile(inputPath, 'utf-8');
  const parsed = ArchiveFile.parse(JSON.parse(raw));
  const events = archiveToEvents(parsed.ig_stories);

  const here = dirname(fileURLToPath(import.meta.url));
  const dataPath = resolve(here, '../../data/events.jsonl');
  const result = await appendNovelEvents(dataPath, events);

  console.log(
    `📦 ig archive: parsed ${parsed.ig_stories.length}, mapped ${events.length}, appended ${result.appended}, skipped ${result.skipped}`,
  );
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('fatal:', err);
    process.exit(1);
  });
}
