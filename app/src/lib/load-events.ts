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
