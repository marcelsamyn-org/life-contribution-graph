import type { Source, SourceId } from '../lib/schema';

type Props = {
  sources: Source[];
  enabled: Set<SourceId>;
  onToggle: (id: SourceId) => void;
  onReset: () => void;
};

export function SourceToggles({ sources, enabled, onToggle, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {sources.map((s) => {
        const on = enabled.has(s.id);
        return (
          <button
            type="button"
            key={s.id}
            onClick={() => onToggle(s.id)}
            aria-pressed={on}
            className="text-xs px-2 py-1 rounded-full border transition-colors"
            style={{
              borderColor: on ? 'var(--rule)' : 'var(--rule-soft)',
              background: on ? 'white' : 'transparent',
              color: on ? 'var(--ink)' : 'var(--ink-faint)',
            }}
          >
            <span
              aria-hidden="true"
              className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
              style={{ background: on ? s.color : 'var(--rule)' }}
            />
            {s.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onReset}
        className="px-2 py-1 transition-colors"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6875rem',
          letterSpacing: 'var(--tracking-wider)',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        Reset
      </button>
    </div>
  );
}
