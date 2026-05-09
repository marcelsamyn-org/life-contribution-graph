import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { commitsToEvents } from '../scripts/ingest/code-commits';

describe('commitsToEvents', () => {
  test('produces a code_commit event per commit with author date', async () => {
    const commits = JSON.parse(
      await readFile('tests/fixtures/code-commits.json', 'utf-8'),
    );
    const events = commitsToEvents('marcelsamyn/example', commits);
    expect(events).toHaveLength(2); // null-author-date entry skipped
    expect(events[0]?.source).toBe('code_commit');
  });

  test('event id is deterministic: code:<owner/repo>:<sha>', async () => {
    const commits = JSON.parse(
      await readFile('tests/fixtures/code-commits.json', 'utf-8'),
    );
    const events = commitsToEvents('marcelsamyn/example', commits);
    expect(events[0]?.id).toBe(
      'code:marcelsamyn/example:abc123def456789012345678901234567890aaaa',
    );
  });

  test('message is truncated to the first line', async () => {
    const commits = JSON.parse(
      await readFile('tests/fixtures/code-commits.json', 'utf-8'),
    );
    const events = commitsToEvents('marcelsamyn/example', commits);
    if (events[0]?.source === 'code_commit') {
      expect(events[0].message).toBe('feat(api): add /heartbeat endpoint');
    }
  });

  test('preserves the repo on every event', async () => {
    const commits = JSON.parse(
      await readFile('tests/fixtures/code-commits.json', 'utf-8'),
    );
    const events = commitsToEvents('foo/bar', commits);
    for (const e of events) {
      if (e.source === 'code_commit') {
        expect(e.repo).toBe('foo/bar');
      }
    }
  });
});
