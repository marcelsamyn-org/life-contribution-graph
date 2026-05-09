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
