import { describe, expect, test } from 'bun:test';
import { facts } from '../app/src/lib/facts';
import { calendarYearRange, type Range } from '../app/src/lib/range';
import type { Event } from '../app/src/lib/schema';

const events: Event[] = [
  { id: 'a', source: 'youtube_long', date: '2026-01-15', durationSec: 1800, title: 't' },
  { id: 'b', source: 'youtube_long', date: '2026-02-20', durationSec: 3600, title: 't' },
  { id: 'c', source: 'ig_reel', date: '2026-03-01', durationSec: 30 },
  { id: 'd', source: 'ig_post', date: '2026-03-02' },
  { id: 'e', source: 'ig_story', date: '2026-03-03' },
  { id: 'f', source: 'book_commit', date: '2026-04-01', linesAdded: 100 },
  { id: 'g', source: 'book_commit', date: '2026-04-02', linesAdded: 80 },
  { id: 'h', source: 'ig_post', date: '2025-12-30' }, // outside 2026
];

const year2026 = calendarYearRange(2026);

describe('facts', () => {
  test('there are at least 6 fact functions', () => {
    expect(facts.length).toBeGreaterThanOrEqual(6);
  });

  test('every fact returns a string or null when given valid input', () => {
    for (const fact of facts) {
      const out = fact(events, year2026);
      expect(out === null || typeof out === 'string').toBe(true);
    }
  });

  test('every fact returns null for an empty range', () => {
    for (const fact of facts) {
      expect(fact([], year2026)).toBeNull();
    }
  });

  test('count fact reports the in-range event count', () => {
    const countFact = facts[0]!;
    const text = countFact(events, year2026);
    expect(text).toContain('7'); // 7 events in 2026
    expect(text).toContain('2026'); // label appears
  });

  test('long-form hours fact reports hours of long-form video', () => {
    const hoursFact = facts.find((f) => /hour/.test(f(events, year2026) ?? ''));
    expect(hoursFact).toBeDefined();
  });

  test('book days fact returns null when no book commits', () => {
    const noBook: Event[] = [{ id: 'x', source: 'ig_post', date: '2026-01-01' }];
    const bookFact = facts.find((f) => /book/.test(f(events, year2026) ?? ''));
    expect(bookFact).toBeDefined();
    expect(bookFact!(noBook, year2026)).toBeNull();
  });

  test('rolling-style range labels appear verbatim in fact text', () => {
    const rolling: Range = { start: '2025-05-10', end: '2026-05-09', label: 'last 365 days' };
    const countFact = facts[0]!;
    const text = countFact(events, rolling);
    expect(text).toContain('last 365 days');
  });

  test('events outside range are excluded', () => {
    // h is on 2025-12-30, outside year2026 — count should be 7, not 8
    const countFact = facts[0]!;
    const text = countFact(events, year2026);
    expect(text).not.toContain('8 ');
  });
});
