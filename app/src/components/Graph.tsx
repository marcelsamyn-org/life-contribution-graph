import { useEffect, useMemo, useState } from 'react';
import { blastBySource } from '../lib/blast';
import {
  type DayCell,
  fanOut,
  filterEnabled,
  groupByDay,
  rangeGrid,
} from '../lib/compute';
import { calendarYearRange, type Range, rollingRange } from '../lib/range';
import type { Event, Source, SourceId } from '../lib/schema';
import { DayDrawer } from './DayDrawer';
import { Heatmap } from './Heatmap';
import { Minimap } from './Minimap';
import { RangeSelector } from './RangeSelector';
import { RotatingFooter } from './RotatingFooter';
import { SourceToggles } from './SourceToggles';

type Props = {
  events: Event[];
  sources: Source[];
};

const STORAGE_KEY = 'lcg.enabled';

function defaultEnabled(sources: Source[]): Set<SourceId> {
  return new Set(sources.filter((s) => s.defaultEnabled).map((s) => s.id));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function readHash(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.hash.slice(1));
}

function loadEnabled(sources: Source[]): Set<SourceId> {
  if (typeof window === 'undefined') return defaultEnabled(sources);
  const fromHash = readHash().get('s');
  if (fromHash !== null) {
    const ids = fromHash.split(',').filter(Boolean) as SourceId[];
    return new Set(ids.filter((id) => sources.some((s) => s.id === id)));
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const ids = JSON.parse(stored) as SourceId[];
      return new Set(ids.filter((id) => sources.some((s) => s.id === id)));
    } catch {
      // fallthrough
    }
  }
  return defaultEnabled(sources);
}

function loadRange(today: string): Range {
  const fallback = rollingRange(today, 365);
  if (typeof window === 'undefined') return fallback;
  const raw = readHash().get('r');
  if (!raw) return fallback;
  const [start, end, ...rest] = raw.split(':');
  const label = rest.join(':');
  if (!start || !end || !label) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return fallback;
  return { start, end, label };
}

export function Graph({ events, sources }: Props) {
  const [today] = useState(() => todayISO());
  const [enabled, setEnabled] = useState<Set<SourceId>>(() => defaultEnabled(sources));
  const [selectedRange, setSelectedRange] = useState<Range>(() => rollingRange(today, 365));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Hydrate from URL hash + localStorage on mount.
  useEffect(() => {
    setEnabled(loadEnabled(sources));
    setSelectedRange(loadRange(today));
  }, [sources, today]);

  // Persist enabled + range to localStorage + URL hash.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ids = [...enabled].sort();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    const hash = readHash();
    hash.set('s', ids.join(','));
    hash.set('r', `${selectedRange.start}:${selectedRange.end}:${selectedRange.label}`);
    window.history.replaceState(null, '', `#${hash.toString()}`);
  }, [enabled, selectedRange]);

  const totals = useMemo(() => {
    const filtered = filterEnabled(events, enabled);
    return groupByDay(fanOut(filtered, blastBySource));
  }, [events, enabled]);

  const grid: DayCell[][] = useMemo(
    () => rangeGrid(selectedRange, totals),
    [selectedRange, totals],
  );

  const toggle = (id: SourceId) => {
    setEnabled((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => setEnabled(defaultEnabled(sources));

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-12">
      <header className="mb-6">
        <h1 className="text-base font-medium">Marcel Samyn — life contribution graph</h1>
        <p className="text-xs text-stone-500 mt-1">
          a record of giving, without expectation of outcome
        </p>
      </header>

      <RangeSelector
        events={events}
        today={today}
        selected={selectedRange}
        onSelect={setSelectedRange}
      />

      <SourceToggles
        sources={sources}
        enabled={enabled}
        onToggle={toggle}
        onReset={reset}
      />

      <Heatmap
        grid={grid}
        onHover={() => {
          /* hover state can be added later */
        }}
        onClick={(cell) => {
          if (cell) setSelectedDate(cell.date);
        }}
        selectedDate={selectedDate}
      />

      <div className="mt-8">
        <Minimap
          events={events}
          enabled={enabled}
          range={selectedRange}
          onSelectYear={(year) => setSelectedRange(calendarYearRange(year))}
        />
      </div>

      <RotatingFooter events={events} range={selectedRange} />

      <DayDrawer
        date={selectedDate}
        events={events}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}
