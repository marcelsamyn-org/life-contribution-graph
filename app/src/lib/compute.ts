import type { BlastFn, DayIntensity } from './blast';
import type { Range } from './range';
import type { Event, SourceId } from './schema';

export type DayCell = { date: string; intensity: number } | null;

export function filterEnabled(events: Event[], enabled: Set<SourceId>): Event[] {
  return events.filter((e) => enabled.has(e.source));
}

export function fanOut(
  events: Event[],
  blast: Record<SourceId, BlastFn>,
): DayIntensity[] {
  return events.flatMap((e) => blast[e.source](e));
}

export function groupByDay(intensities: DayIntensity[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const { date, intensity } of intensities) {
    out.set(date, (out.get(date) ?? 0) + intensity);
  }
  return out;
}

function parseDate(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map((s) => Number.parseInt(s, 10)) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Returns a week-major grid (Sunday-start, column 0 = Sunday) covering `range`.
 * Width is the minimum number of weeks needed to contain [range.start, range.end].
 * Cells outside the range (padding before start / after end) are null.
 */
export function rangeGrid(range: Range, totals: Map<string, number>): DayCell[][] {
  const start = parseDate(range.start);
  const end = parseDate(range.end);
  const startDow = start.getUTCDay();

  const gridStart = new Date(start);
  gridStart.setUTCDate(gridStart.getUTCDate() - startDow);

  const totalDaysFromGridStart =
    Math.round((end.getTime() - gridStart.getTime()) / 86_400_000) + 1;
  const weeks = Math.ceil(totalDaysFromGridStart / 7);

  const grid: DayCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(gridStart);
      cur.setUTCDate(gridStart.getUTCDate() + w * 7 + d);
      if (cur < start || cur > end) {
        week.push(null);
      } else {
        const key = fmtDate(cur);
        week.push({ date: key, intensity: totals.get(key) ?? 0 });
      }
    }
    grid.push(week);
  }
  return grid;
}
