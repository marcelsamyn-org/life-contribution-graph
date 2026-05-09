import { test, expect, describe } from 'bun:test';
import { quantileBuckets, bucketColor } from '../app/src/lib/color';

describe('quantileBuckets', () => {
  test('returns 4 cut points for 5 buckets', () => {
    const cuts = quantileBuckets([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(cuts).toHaveLength(4);
  });

  test('returns ascending cut points', () => {
    const cuts = quantileBuckets([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (let i = 1; i < cuts.length; i++) {
      expect(cuts[i]!).toBeGreaterThanOrEqual(cuts[i - 1]!);
    }
  });

  test('ignores zero values when computing quantiles', () => {
    // Quiet years: many zeros + a few real values.
    // The cut points should reflect the real distribution, not be pulled to 0.
    const cuts = quantileBuckets([0, 0, 0, 0, 0, 0, 0, 1, 5, 10]);
    expect(cuts[0]!).toBeGreaterThan(0);
  });

  test('returns all-zero cuts when all values are zero', () => {
    const cuts = quantileBuckets([0, 0, 0]);
    expect(cuts).toEqual([0, 0, 0, 0]);
  });
});

describe('bucketColor', () => {
  test('returns a hex string', () => {
    const color = bucketColor(0);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('different buckets produce different colors', () => {
    expect(bucketColor(0)).not.toBe(bucketColor(4));
  });
});
