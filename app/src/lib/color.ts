import { interpolate, formatHex } from 'culori';

const stops = [
  'oklch(0.96 0 0)',       // empty — soft paper
  'oklch(0.85 0.08 145)',
  'oklch(0.72 0.14 145)',
  'oklch(0.58 0.18 145)',
  'oklch(0.42 0.20 145)',  // p95+ — deep verdant
];

const interp = interpolate(stops, 'oklch');

export function bucketColor(bucket: 0 | 1 | 2 | 3 | 4): string {
  const hex = formatHex(interp(bucket / 4));
  return hex ?? '#ffffff';
}

/**
 * Returns 4 cut points splitting non-zero values into 5 buckets via p25/p50/p75/p95.
 * Zero values are excluded from the quantile computation so a quiet year with many
 * zero days still produces a meaningful intensity scale on the live days.
 */
export function quantileBuckets(values: number[]): [number, number, number, number] {
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return [0, 0, 0, 0];
  const q = (p: number): number => {
    const idx = (nonZero.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return nonZero[lo]!;
    const frac = idx - lo;
    return nonZero[lo]! + (nonZero[hi]! - nonZero[lo]!) * frac;
  };
  return [q(0.25), q(0.5), q(0.75), q(0.95)];
}

export function bucketFor(value: number, cuts: [number, number, number, number]): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0;
  if (value <= cuts[0]) return 1;
  if (value <= cuts[1]) return 2;
  if (value <= cuts[2]) return 3;
  return 4;
}
