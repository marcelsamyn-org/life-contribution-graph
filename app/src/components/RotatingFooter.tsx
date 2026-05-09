import { useEffect, useMemo, useState } from 'react';
import { facts } from '../lib/facts';
import type { Range } from '../lib/range';
import type { Event } from '../lib/schema';

const ROTATE_MS = 10_000;
const CHAR_DELAY_MS = 25;

type Props = {
  events: Event[];
  range: Range;
};

export function RotatingFooter({ events, range }: Props) {
  const lines = useMemo(
    () => facts.map((f) => f(events, range)).filter((s): s is string => s !== null),
    [events, range],
  );
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (lines.length === 0) return;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (document.hidden) {
        timer = setTimeout(tick, ROTATE_MS);
        return;
      }
      setVisible(false);
      timer = setTimeout(() => {
        setI((cur) => (cur + 1) % lines.length);
        setVisible(true);
        timer = setTimeout(tick, ROTATE_MS);
      }, (lines[0]?.length ?? 0) * CHAR_DELAY_MS + 200);
    };

    timer = setTimeout(tick, ROTATE_MS);
    return () => clearTimeout(timer);
  }, [lines]);

  if (lines.length === 0) return null;
  const current = lines[i] ?? '';

  return (
    <p
      className="text-sm text-stone-500 tabular-nums tracking-tight mt-6 min-h-5"
      aria-live="polite"
    >
      {[...current].map((ch, idx) => (
        <span
          key={`${i}-${idx}`}
          style={{
            transition: 'opacity 200ms ease',
            transitionDelay: `${idx * CHAR_DELAY_MS}ms`,
            opacity: visible ? 1 : 0,
            display: 'inline-block',
            whiteSpace: 'pre',
          }}
        >
          {ch}
        </span>
      ))}
    </p>
  );
}
