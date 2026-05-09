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
    case 'code_commit':
      return `${e.repo}${e.message ? ` — ${e.message.slice(0, 80)}` : ''}`;
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
      className="fixed top-0 right-0 h-screen w-full max-w-sm p-6 overflow-y-auto"
      style={{
        background: 'var(--paper)',
        borderLeft: '1px solid var(--rule)',
        boxShadow:
          '0 4px 16px -4px rgba(28,25,23,0.12), 0 24px 48px -16px rgba(28,25,23,0.16)',
        zIndex: 20,
      }}
      aria-label={`events on ${date}`}
    >
      <div className="flex items-baseline justify-between mb-5">
        <h2
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: 'var(--tracking-wider)',
            textTransform: 'uppercase',
            color: 'var(--accent)',
          }}
        >
          {date}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="close"
          className="text-lg leading-none transition-colors"
          style={{ color: 'var(--ink-muted)' }}
          onMouseEnter={(ev) => {
            ev.currentTarget.style.color = 'var(--accent)';
          }}
          onMouseLeave={(ev) => {
            ev.currentTarget.style.color = 'var(--ink-muted)';
          }}
        >
          ×
        </button>
      </div>
      {dayEvents.length === 0 ? (
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '0.95rem',
            color: 'var(--ink-muted)',
          }}
        >
          no gifts this day
        </p>
      ) : (
        <ul className="space-y-3">
          {dayEvents.map((e) => {
            const url = eventUrl(e);
            const label = eventLabel(e);
            return (
              <li
                key={e.id}
                className="text-sm"
                style={{ color: 'var(--ink)', lineHeight: 1.55 }}
              >
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="kalon-link"
                  >
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
