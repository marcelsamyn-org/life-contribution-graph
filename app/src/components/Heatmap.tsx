import { useMemo } from 'react';
import { bucketColor, bucketFor, quantileBuckets } from '../lib/color';
import type { DayCell } from '../lib/compute';

type Props = {
  grid: DayCell[][];
  onHover: (cell: DayCell) => void;
  onClick: (cell: DayCell) => void;
  selectedDate: string | null;
};

export function Heatmap({ grid, onHover, onClick, selectedDate }: Props) {
  const cuts = useMemo(() => {
    const values = grid.flat().map((c) => (c ? c.intensity : 0));
    return quantileBuckets(values);
  }, [grid]);

  return (
    <div
      className="grid grid-flow-col gap-[3px]"
      role="grid"
      aria-label="contribution heatmap"
    >
      {grid.map((week, w) => (
        <div key={w} className="grid grid-rows-7 gap-[3px]" role="row">
          {week.map((cell, d) => {
            if (!cell) {
              return <div key={d} className="w-3 h-3" aria-hidden="true" />;
            }
            const bucket = bucketFor(cell.intensity, cuts);
            const color =
              cell.intensity > 0 ? bucketColor(bucket) : 'var(--paper-inset)';
            const isSelected = selectedDate === cell.date;
            return (
              <button
                type="button"
                key={d}
                aria-label={`${cell.date}, intensity ${cell.intensity.toFixed(2)}`}
                className="w-3 h-3 rounded-[2px] transition-shadow"
                style={{
                  background: color,
                  boxShadow: isSelected
                    ? '0 0 0 1px var(--paper), 0 0 0 3px var(--primary)'
                    : undefined,
                }}
                onMouseEnter={() => onHover(cell)}
                onFocus={() => onHover(cell)}
                onClick={() => onClick(cell)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
