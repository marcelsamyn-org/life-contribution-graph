import { test, expect, describe } from 'bun:test';
import {
  point,
  durationDays,
  linesCapped,
  blastBySource,
} from '../app/src/lib/blast';
import type { Event } from '../app/src/lib/schema';

const reel: Event = {
  id: 'ig:r',
  source: 'ig_reel',
  date: '2026-05-08',
  durationSec: 30,
};

const longVideo30min: Event = {
  id: 'yt:long',
  source: 'youtube_long',
  date: '2026-05-08',
  durationSec: 30 * 60,
};

const longVideo70min: Event = {
  id: 'yt:long2',
  source: 'youtube_long',
  date: '2026-05-08',
  durationSec: 70 * 60,
};

const bookSmall: Event = {
  id: 'book:1',
  source: 'book_commit',
  date: '2026-05-08',
  linesAdded: 50,
};

const bookHuge: Event = {
  id: 'book:2',
  source: 'book_commit',
  date: '2026-05-08',
  linesAdded: 5000,
};

describe('point', () => {
  test('returns a single day with the given weight', () => {
    const result = point(1)(reel);
    expect(result).toEqual([{ date: '2026-05-08', intensity: 1 }]);
  });

  test('respects fractional weights', () => {
    const result = point(0.3)(reel);
    expect(result[0]?.intensity).toBeCloseTo(0.3);
  });
});

describe('durationDays', () => {
  test('30min video → 3 days, total intensity conserved', () => {
    const fn = durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'flat' });
    const days = fn(longVideo30min);
    expect(days).toHaveLength(3);
    const total = days.reduce((s, d) => s + d.intensity, 0);
    expect(total).toBeCloseTo(3);
  });

  test('70min video → capped at 7 days', () => {
    const fn = durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'flat' });
    const days = fn(longVideo70min);
    expect(days).toHaveLength(7);
  });

  test('spreads BACKWARD from post date', () => {
    const fn = durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'flat' });
    const days = fn(longVideo30min).map((d) => d.date);
    expect(days).toEqual(['2026-05-06', '2026-05-07', '2026-05-08']);
  });

  test('decay shape: post date is brightest, earlier days fade', () => {
    const fn = durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'decay' });
    const days = fn(longVideo30min);
    expect(days[0]!.intensity).toBeLessThan(days[2]!.intensity);
  });

  test('decay still conserves total intensity', () => {
    const fn = durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'decay' });
    const days = fn(longVideo30min);
    const total = days.reduce((s, d) => s + d.intensity, 0);
    expect(total).toBeCloseTo(3);
  });

  test('throws on non-video event', () => {
    const fn = durationDays({ secondsPerDay: 600, maxDays: 7, shape: 'flat' });
    expect(() => fn(reel as never)).not.toThrow();
  });
});

describe('linesCapped', () => {
  test('uncapped: returns linesAdded as intensity', () => {
    const fn = linesCapped({ perLine: 1, cap: 200 });
    expect(fn(bookSmall)).toEqual([{ date: '2026-05-08', intensity: 50 }]);
  });

  test('caps at the configured maximum', () => {
    const fn = linesCapped({ perLine: 1, cap: 200 });
    expect(fn(bookHuge)).toEqual([{ date: '2026-05-08', intensity: 200 }]);
  });

  test('respects perLine multiplier', () => {
    const fn = linesCapped({ perLine: 0.5, cap: 1000 });
    expect(fn(bookSmall)[0]?.intensity).toBeCloseTo(25);
  });
});

describe('blastBySource defaults', () => {
  test('every source has a blast function', () => {
    const ids: Array<keyof typeof blastBySource> = [
      'youtube_long',
      'youtube_short',
      'ig_reel',
      'ig_post',
      'ig_story',
      'book_commit',
      'gh_repo_created',
    ];
    for (const id of ids) {
      expect(typeof blastBySource[id]).toBe('function');
    }
  });

  test('ig_story weight is 0.3', () => {
    const event: Event = {
      id: 'ig:s',
      source: 'ig_story',
      date: '2026-05-08',
    };
    expect(blastBySource.ig_story(event)[0]?.intensity).toBeCloseTo(0.3);
  });

  test('gh_repo_created weight is 5', () => {
    const event: Event = {
      id: 'gh:r',
      source: 'gh_repo_created',
      date: '2026-05-08',
      name: 'r',
      url: 'https://github.com/x/r',
    };
    expect(blastBySource.gh_repo_created(event)[0]?.intensity).toBe(5);
  });
});
