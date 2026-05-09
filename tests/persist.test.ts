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
