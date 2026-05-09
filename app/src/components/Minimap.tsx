import { useMemo } from 'react';
import { blastBySource } from '../lib/blast';
import { bucketColor, bucketFor, quantileBuckets } from '../lib/color';
import { fanOut, filterEnabled, groupByDay } from '../lib/compute';
import type { Range } from '../lib/range';
import type { Event, SourceId } from '../lib/schema';

type Props = {
  events: Event[];
  enabled: Set<SourceId>;
  range: Range;
  onSelectYear: (year: number) => void;
};

type YearStat = { year: number; total: number };

function yearsTouchedBy(range: Range): Set<number> {
  const startY = Number.parseInt(range.start.slice(0, 4), 10);
  const endY = Number.parseInt(range.end.slice(0, 4), 10);
  const out = new Set<number>();
  for (let y = startY; y <= endY; y++) out.add(y);
  return out;
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Fraction of the calendar year elapsed at the given local date (0..1]. */
function yearFractionElapsed(date: Date): number {
  const y = date.getFullYear();
  const start = new Date(y, 0, 1).getTime();
  const now = new Date(y, date.getMonth(), date.getDate()).getTime();
  // +1 day so day-of-year 1 = 1/365, not 0.
  const elapsedDays = Math.floor((now - start) / 86_400_000) + 1;
  const totalDays = isLeapYear(y) ? 366 : 365;
  return Math.min(1, Math.max(1 / totalDays, elapsedDays / totalDays));
}

export function Minimap({ events, enabled, range, onSelectYear }: Props) {
  const stats: YearStat[] = useMemo(() => {
    const filtered = filterEnabled(events, enabled);
    const totals = groupByDay(fanOut(filtered, blastBySource));
    const byYear = new Map<number, number>();
    for (const [date, value] of totals) {
      const y = Number.parseInt(date.slice(0, 4), 10);
      byYear.set(y, (byYear.get(y) ?? 0) + value);
    }
    if (byYear.size === 0) return [];
    const years = [...byYear.keys()].sort((a, b) => a - b);
    const first = years[0]!;
    const last = years[years.length - 1]!;
    const out: YearStat[] = [];
    for (let y = first; y <= last; y++) {
      out.push({ year: y, total: byYear.get(y) ?? 0 });
    }
    return out;
  }, [events, enabled]);

  const currentYear = new Date().getFullYear();
  const fractionElapsed = yearFractionElapsed(new Date());

  /** Effective height-driving total: actual for past years, projected for current year. */
  const effective = (s: YearStat): number =>
    s.year === currentYear ? s.total / fractionElapsed : s.total;

  const max = useMemo(
    () => stats.reduce((m, s) => Math.max(m, effective(s)), 0) || 1,
    [stats, currentYear, fractionElapsed],
  );
  const cuts = useMemo(() => quantileBuckets(stats.map((s) => s.total)), [stats]);
  const activeYears = useMemo(() => yearsTouchedBy(range), [range]);
  const emptyColor = 'var(--paper-inset)';

  if (stats.length === 0) return null;

  const labelEvery = Math.max(1, Math.ceil(stats.length / 8));

  return (
    <div className="w-full" aria-label="year minimap">
      <div className="flex items-end gap-1 h-12 w-full">
        {stats.map((s) => {
          const heightVal = effective(s);
          const height = `${Math.max(4, (heightVal / max) * 100)}%`;
          const bucket = bucketFor(heightVal, cuts);
          const color = heightVal > 0 ? bucketColor(bucket) : emptyColor;
          const isActive = activeYears.has(s.year);
          const isCurrent = s.year === currentYear;
          const baseClass = `flex-1 rounded-sm overflow-hidden transition-opacity ${
            isActive ? 'opacity-100' : 'opacity-80 hover:opacity-100'
          }`;
          const activeOutline = isActive
            ? '0 0 0 1px var(--primary)'
            : undefined;
          const ariaLabel = isCurrent
            ? `select calendar year ${s.year}, total ${s.total.toFixed(0)} so far, on track for ${heightVal.toFixed(0)}`
            : `select calendar year ${s.year}, total ${s.total.toFixed(0)}`;
          return (
            <button
              type="button"
              key={s.year}
              onClick={() => onSelectYear(s.year)}
              aria-label={ariaLabel}
              className={baseClass}
              style={
                isCurrent
                  ? { height, display: 'flex', boxShadow: activeOutline }
                  : { height, background: color, boxShadow: activeOutline }
              }
            >
              {isCurrent ? (
                <>
                  <div
                    style={{
                      width: `${fractionElapsed * 100}%`,
                      background: color,
                    }}
                  />
                  <div
                    style={{
                      width: `${(1 - fractionElapsed) * 100}%`,
                      background: emptyColor,
                    }}
                  />
                </>
              ) : null}
            </button>
          );
        })}
      </div>
      <div
        className="flex gap-1 mt-1.5 w-full"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.05em',
          color: 'var(--ink-muted)',
        }}
      >
        {stats.map((s, i) => {
          const showLabel =
            activeYears.has(s.year) ||
            i === 0 ||
            i === stats.length - 1 ||
            i % labelEvery === 0;
          const isActive = activeYears.has(s.year);
          return (
            <div
              key={s.year}
              className="flex-1 text-center"
              style={isActive ? { color: 'var(--primary)' } : undefined}
            >
              {showLabel ? `'${String(s.year).slice(2)}` : ' '}
            </div>
          );
        })}
      </div>
    </div>
  );
}
