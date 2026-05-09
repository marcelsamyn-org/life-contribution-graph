import type { Event, SourceId } from './schema';
import type { BlastFn, DayIntensity } from './blast';

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

function fmtDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns a 53×7 grid (week-major). Week starts Sunday (column 0).
 * The grid spans the calendar year `year`. Cells outside that year are null.
 */
export function yearGrid(year: number, totals: Map<string, number>): DayCell[][] {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dec31 = new Date(Date.UTC(year, 11, 31));
  const startDow = jan1.getUTCDay(); // 0=Sun..6=Sat
  // Start grid on the Sunday on/before Jan 1.
  const gridStart = new Date(jan1);
  gridStart.setUTCDate(gridStart.getUTCDate() - startDow);

  const weeks: DayCell[][] = [];
  for (let w = 0; w < 53; w++) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(gridStart);
      cur.setUTCDate(gridStart.getUTCDate() + w * 7 + d);
      if (cur < jan1 || cur > dec31) {
        week.push(null);
      } else {
        const key = fmtDate(cur);
        week.push({ date: key, intensity: totals.get(key) ?? 0 });
      }
    }
    weeks.push(week);
  }
  return weeks;
}
