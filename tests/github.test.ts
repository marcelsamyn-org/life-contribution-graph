import { test, expect, describe } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parseGitShortstat, reposToEvents } from '../scripts/ingest/github';

describe('parseGitShortstat', () => {
  test('extracts commits with linesAdded and message', async () => {
    const text = await readFile('tests/fixtures/git-shortstat.txt', 'utf-8');
    const events = parseGitShortstat(text);
    expect(events).toHaveLength(2);
    const draft = events.find((e) => e.id === 'book:e7a91f2c0d6b4e8f1234567890abcdef12345678');
    expect(draft?.source).toBe('book_commit');
    if (draft?.source === 'book_commit') {
      expect(draft.linesAdded).toBe(312);
      expect(draft.message).toBe('chapter 3 draft');
    }
  });
});

describe('reposToEvents', () => {
  test('produces a gh_repo_created per public repo', async () => {
    const repos = JSON.parse(await readFile('tests/fixtures/github-repos.json', 'utf-8'));
    const events = reposToEvents(repos);
    expect(events).toHaveLength(2);
    expect(events[0]?.source).toBe('gh_repo_created');
  });

  test('skips private repos', () => {
    const events = reposToEvents([
      { name: 'secret', html_url: 'https://github.com/x/secret', created_at: '2026-01-01T00:00:00Z', private: true },
    ]);
    expect(events).toEqual([]);
  });
});
