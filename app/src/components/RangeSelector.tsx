import { calendarYearRange, rollingRange, type Range } from '../lib/range';
import type { Event } from '../lib/schema';

type Props = {
  events: Event[];
  today: string;
  selected: Range;
  onSelect: (range: Range) => void;
};

function isSameRange(a: Range, b: Range): boolean {
  return a.start === b.start && a.end === b.end;
}

export function RangeSelector({ events, today, selected, onSelect }: Props) {
  const years = [...new Set(events.map((e) => Number.parseInt(e.date.slice(0, 4), 10)))].sort(
    (a, b) => b - a,
  );

  const rolling = rollingRange(today, 365);
  const options: Range[] = [rolling, ...years.map(calendarYearRange)];

  return (
    <div className="flex flex-wrap items-center gap-1 mb-3" role="tablist" aria-label="time range">
      {options.map((r) => {
        const active = isSameRange(r, selected);
        return (
          <button
            type="button"
            key={`${r.start}_${r.end}`}
            onClick={() => onSelect(r)}
            role="tab"
            aria-selected={active}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              active
                ? 'border-stone-700 bg-stone-900 text-white'
                : 'border-stone-200 bg-white text-stone-600 hover:text-stone-900'
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
