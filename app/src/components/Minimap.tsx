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

  const max = useMemo(() => stats.reduce((m, s) => Math.max(m, s.total), 0) || 1, [stats]);
  const cuts = useMemo(() => quantileBuckets(stats.map((s) => s.total)), [stats]);
  const activeYears = useMemo(() => yearsTouchedBy(range), [range]);

  if (stats.length === 0) return null;

  const labelEvery = Math.max(1, Math.ceil(stats.length / 8));

  return (
    <div className="w-full" aria-label="year minimap">
      <div className="flex items-end gap-1 h-12 w-full">
        {stats.map((s) => {
          const height = `${Math.max(4, (s.total / max) * 100)}%`;
          const bucket = bucketFor(s.total, cuts);
          const color = s.total > 0 ? bucketColor(bucket) : 'oklch(0.93 0 0)';
          const isActive = activeYears.has(s.year);
          return (
            <button
              type="button"
              key={s.year}
              onClick={() => onSelectYear(s.year)}
              aria-label={`select calendar year ${s.year}, total ${s.total.toFixed(0)}`}
              className={`flex-1 rounded-sm transition-opacity ${
                isActive
                  ? 'opacity-100 outline outline-1 outline-stone-700'
                  : 'opacity-80 hover:opacity-100'
              }`}
              style={{ height, background: color }}
            />
          );
        })}
      </div>
      <div className="flex gap-1 mt-1 w-full text-[10px] tabular-nums opacity-60">
        {stats.map((s, i) => {
          const showLabel =
            activeYears.has(s.year) ||
            i === 0 ||
            i === stats.length - 1 ||
            i % labelEvery === 0;
          return (
            <div key={s.year} className="flex-1 text-center">
              {showLabel ? `'${String(s.year).slice(2)}` : ' '}
            </div>
          );
        })}
      </div>
    </div>
  );
}
