import type { Event } from '../lib/schema';

type Props = {
  date: string | null;
  events: Event[];
  onClose: () => void;
};

function eventLabel(e: Event): string {
  switch (e.source) {
    case 'youtube_long':
      return `YouTube long-form${e.title ? ` — ${e.title}` : ''} (${Math.round(e.durationSec / 60)}m)`;
    case 'youtube_short':
      return `YouTube short${e.title ? ` — ${e.title}` : ''} (${e.durationSec}s)`;
    case 'ig_reel':
      return `Instagram reel (${e.durationSec}s)`;
    case 'ig_post':
      return `Instagram post${e.caption ? ` — ${e.caption.slice(0, 60)}` : ''}`;
    case 'ig_story':
      return 'Instagram story';
    case 'book_commit':
      return `Book commit — ${e.linesAdded} lines${e.message ? ` (${e.message.slice(0, 60)})` : ''}`;
    case 'gh_repo_created':
      return `New repo — ${e.name}`;
  }
}

function eventUrl(e: Event): string | undefined {
  if ('url' in e) return e.url;
  return undefined;
}

export function DayDrawer({ date, events, onClose }: Props) {
  if (!date) return null;
  const dayEvents = events.filter((e) => e.date === date);

  return (
    <aside
      className="fixed top-0 right-0 h-screen w-full max-w-sm bg-white border-l border-stone-200 shadow-xl p-6 overflow-y-auto"
      aria-label={`events on ${date}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium tabular-nums">{date}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="close"
          className="text-stone-500 hover:text-stone-900"
        >
          ×
        </button>
      </div>
      {dayEvents.length === 0 ? (
        <p className="text-sm text-stone-400">no gifts this day</p>
      ) : (
        <ul className="space-y-3">
          {dayEvents.map((e) => {
            const url = eventUrl(e);
            const label = eventLabel(e);
            return (
              <li key={e.id} className="text-sm">
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="underline decoration-stone-300 hover:decoration-stone-700">
                    {label}
                  </a>
                ) : (
                  label
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
