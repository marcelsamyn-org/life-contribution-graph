import { describe, expect, test } from 'bun:test';
import { blastBySource } from '../app/src/lib/blast';
import {
  type DayCell,
  fanOut,
  filterEnabled,
  groupByDay,
  rangeGrid,
} from '../app/src/lib/compute';
import { calendarYearRange, rollingRange } from '../app/src/lib/range';
import type { Event, SourceId } from '../app/src/lib/schema';

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

describe('rangeGrid', () => {
  test('calendar year 2026 → 53 weeks × 7 days', () => {
    const grid = rangeGrid(calendarYearRange(2026), new Map());
    expect(grid).toHaveLength(53);
    for (const week of grid) {
      expect(week).toHaveLength(7);
    }
  });

  test('rolling 365 → 53 weeks × 7 days', () => {
    const grid = rangeGrid(rollingRange('2026-05-09'), new Map());
    expect(grid).toHaveLength(53);
    for (const week of grid) {
      expect(week).toHaveLength(7);
    }
  });

  test('places intensities on the right day', () => {
    const totals = new Map([['2026-05-08', 2.5]]);
    const grid = rangeGrid(calendarYearRange(2026), totals);
    const cells: DayCell[] = grid.flat().filter((c) => c !== null);
    const found = cells.find((c) => c?.date === '2026-05-08');
    expect(found?.intensity).toBe(2.5);
  });

  test('cells before range.start / after range.end are null', () => {
    const grid = rangeGrid(calendarYearRange(2026), new Map());
    const nulls = grid.flat().filter((c) => c === null);
    expect(nulls.length).toBeGreaterThan(0);
  });

  test('rolling range starts at Sunday-aligned grid before range.start', () => {
    const range = rollingRange('2026-05-09'); // start = 2025-05-10 (Saturday)
    const grid = rangeGrid(range, new Map());
    // First cell of grid is the Sunday on/before range.start
    const firstCell = grid[0]?.[0];
    // Since 2025-05-10 is a Saturday, gridStart = Sunday 2025-05-04
    // That cell is BEFORE range.start so it must be null.
    expect(firstCell).toBeNull();
    // And the cell at week 0, day 6 (the Saturday) is range.start
    expect(grid[0]?.[6]).toEqual({ date: '2025-05-10', intensity: 0 });
  });

  test('range.end is included as the last live cell', () => {
    const grid = rangeGrid(rollingRange('2026-05-09'), new Map());
    const flat = grid.flat();
    const last = [...flat].reverse().find((c) => c !== null);
    expect(last?.date).toBe('2026-05-09');
  });

  test('arbitrary short range works', () => {
    const grid = rangeGrid(
      { start: '2026-05-08', end: '2026-05-14', label: 'week' },
      new Map([['2026-05-10', 1]]),
    );
    // 7-day span starting Friday → spans 2 grid weeks (Sun-Sat boundary)
    expect(grid).toHaveLength(2);
    const found = grid.flat().find((c) => c?.date === '2026-05-10');
    expect(found?.intensity).toBe(1);
  });
});
