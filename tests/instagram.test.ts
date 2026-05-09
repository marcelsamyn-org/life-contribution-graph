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
