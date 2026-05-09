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
