type FetchOpts = {
  retries?: number;
  baseDelayMs?: number;
  headers?: Record<string, string>;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.baseDelayMs ?? 500;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: opts.headers });
      if (res.status >= 500 && attempt < retries) {
        await sleep(baseDelay * 2 ** attempt);
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) throw err;
      await sleep(baseDelay * 2 ** attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetchJson failed');
}
