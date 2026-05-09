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
    const allCells = grid.flat();
    const nulls = allCells.filter((c) => c === null);
    expect(nulls.length).toBeGreaterThan(0);
  });
});
