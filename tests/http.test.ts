import { test, expect, describe, mock } from 'bun:test';
import { fetchJson } from '../scripts/ingest/lib/http';

describe('fetchJson', () => {
  test('returns parsed JSON for 2xx', async () => {
    const original = global.fetch;
    global.fetch = mock(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ) as typeof fetch;
    const result = await fetchJson<{ ok: boolean }>('https://example.com');
    expect(result.ok).toBe(true);
    global.fetch = original;
  });

  test('throws on non-2xx', async () => {
    const original = global.fetch;
    global.fetch = mock(async () =>
      new Response('boom', { status: 500 }),
    ) as typeof fetch;
    await expect(fetchJson('https://example.com')).rejects.toThrow(/500/);
    global.fetch = original;
  });

  test('retries on 5xx and succeeds', async () => {
    let n = 0;
    const original = global.fetch;
    global.fetch = mock(async () => {
      n++;
      if (n < 2) return new Response('boom', { status: 503 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    const result = await fetchJson<{ ok: boolean }>('https://example.com', { retries: 2, baseDelayMs: 1 });
    expect(result.ok).toBe(true);
    expect(n).toBe(2);
    global.fetch = original;
  });
});
