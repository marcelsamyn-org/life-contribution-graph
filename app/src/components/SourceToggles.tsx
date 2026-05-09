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
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
              on
                ? 'border-stone-300 bg-white text-stone-900'
                : 'border-stone-200 bg-stone-50 text-stone-400'
            }`}
          >
            <span
              aria-hidden="true"
              className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
              style={{ background: on ? s.color : 'oklch(0.85 0 0)' }}
            />
            {s.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onReset}
        className="text-xs px-2 py-1 rounded-full text-stone-500 hover:text-stone-700"
      >
        reset
      </button>
    </div>
  );
}
