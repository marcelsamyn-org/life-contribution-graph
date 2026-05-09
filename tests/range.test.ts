import { describe, expect, test } from 'bun:test';
import { calendarYearRange, rollingRange } from '../app/src/lib/range';

describe('rollingRange', () => {
  test('end equals today', () => {
    expect(rollingRange('2026-05-09').end).toBe('2026-05-09');
  });

  test('default span is 365 days inclusive', () => {
    const r = rollingRange('2026-05-09');
    expect(r.start).toBe('2025-05-10');
    expect(r.label).toBe('last 365 days');
  });

  test('respects custom day count', () => {
    const r = rollingRange('2026-05-09', 7);
    expect(r.start).toBe('2026-05-03');
    expect(r.label).toBe('last 7 days');
  });

  test('crosses leap-year boundary correctly', () => {
    // 2024 is a leap year; 365 days back from 2025-03-01 lands 2024-03-01
    const r = rollingRange('2025-03-01');
    expect(r.start).toBe('2024-03-02'); // 365 days inclusive
  });
});

describe('calendarYearRange', () => {
  test('spans Jan 1 to Dec 31', () => {
    const r = calendarYearRange(2026);
    expect(r.start).toBe('2026-01-01');
    expect(r.end).toBe('2026-12-31');
    expect(r.label).toBe('2026');
  });
});
