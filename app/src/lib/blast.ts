import type { Event, SourceId } from './schema';

export type DayIntensity = { date: string; intensity: number };
export type BlastFn = (event: Event) => DayIntensity[];

function shiftDate(yyyymmdd: string, deltaDays: number): string {
  const [y, m, d] = yyyymmdd.split('-').map((s) => Number.parseInt(s, 10)) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

export function point(weight: number): BlastFn {
  return (event) => [{ date: event.date, intensity: weight }];
}

type DurationDaysOpts = {
  secondsPerDay: number;
  maxDays: number;
  shape: 'flat' | 'decay';
};

export function durationDays(opts: DurationDaysOpts): BlastFn {
  return (event) => {
    if (!('durationSec' in event)) return [];
    const rawDays = Math.max(1, Math.ceil(event.durationSec / opts.secondsPerDay));
    const days = Math.min(opts.maxDays, rawDays);
    const totalIntensity = days; // conservation: 1 unit per day
    const offsets = Array.from({ length: days }, (_, i) => -(days - 1 - i));

    if (opts.shape === 'flat') {
      const per = totalIntensity / days;
      return offsets.map((delta) => ({
        date: shiftDate(event.date, delta),
        intensity: per,
      }));
    }

    // decay: linear ramp peaking on post date (index days-1), weights 1..days
    // triangleSum = days*(days+1)/2 normalizes total to `totalIntensity`
    const triangleSum = (days * (days + 1)) / 2;
    return offsets.map((delta, i) => ({
      date: shiftDate(event.date, delta),
      intensity: ((i + 1) / triangleSum) * totalIntensity,
    }));
  };
}

type LinesCappedOpts = { perLine: number; cap: number };

export function linesCapped(opts: LinesCappedOpts): BlastFn {
  return (event) => {
    if (!('linesAdded' in event)) return [];
    const intensity = Math.min(opts.cap, event.linesAdded * opts.perLine);
    return [{ date: event.date, intensity }];
  };
}

export const blastBySource: Record<SourceId, BlastFn> = {
  youtube_long: durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'decay' }),
  youtube_short: point(1),
  ig_reel: point(1),
  ig_post: point(1),
  ig_story: point(0.3),
  book_commit: linesCapped({ perLine: 1, cap: 200 }),
  gh_repo_created: point(5),
};
