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
