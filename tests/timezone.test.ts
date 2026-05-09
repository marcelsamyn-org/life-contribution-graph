import { test, expect, describe } from 'bun:test';
import { toLocalDate, LOCAL_TZ } from '../scripts/ingest/lib/timezone';

describe('toLocalDate', () => {
  test('converts UTC ISO timestamp to YYYY-MM-DD in Marcel\'s TZ', () => {
    // 2026-05-08T22:00:00Z is 2026-05-09 00:00 in Brussels (CEST, UTC+2)
    expect(toLocalDate('2026-05-08T22:00:00Z')).toBe('2026-05-09');
  });

  test('keeps same date when already in business hours UTC', () => {
    expect(toLocalDate('2026-05-08T12:00:00Z')).toBe('2026-05-08');
  });

  test('handles winter offset (UTC+1, CET)', () => {
    expect(toLocalDate('2026-01-15T23:30:00Z')).toBe('2026-01-16');
  });

  test('default TZ is Europe/Brussels', () => {
    expect(LOCAL_TZ).toBe('Europe/Brussels');
  });
});
