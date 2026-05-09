import { test, expect, describe } from 'bun:test';
import { Event, Source } from '../app/src/lib/schema';

describe('Event schema', () => {
  test('parses a youtube_long event', () => {
    const parsed = Event.parse({
      id: 'yt:abc',
      source: 'youtube_long',
      date: '2026-05-08',
      durationSec: 1380,
      title: 'On giving',
      url: 'https://youtu.be/abc',
    });
    expect(parsed.source).toBe('youtube_long');
    if (parsed.source === 'youtube_long') {
      expect(parsed.durationSec).toBe(1380);
    }
  });

  test('parses a youtube_short event', () => {
    const parsed = Event.parse({
      id: 'yt:xyz',
      source: 'youtube_short',
      date: '2026-05-08',
      durationSec: 47,
    });
    expect(parsed.source).toBe('youtube_short');
  });

  test('parses an ig_reel event', () => {
    const parsed = Event.parse({
      id: 'ig:reel:1',
      source: 'ig_reel',
      date: '2026-05-08',
      durationSec: 30,
    });
    expect(parsed.source).toBe('ig_reel');
  });

  test('parses an ig_post event', () => {
    const parsed = Event.parse({
      id: 'ig:post:1',
      source: 'ig_post',
      date: '2026-05-08',
    });
    expect(parsed.source).toBe('ig_post');
  });

  test('parses an ig_story event', () => {
    const parsed = Event.parse({
      id: 'ig:story:1',
      source: 'ig_story',
      date: '2026-05-08',
    });
    expect(parsed.source).toBe('ig_story');
  });

  test('parses a book_commit event', () => {
    const parsed = Event.parse({
      id: 'book:e7a',
      source: 'book_commit',
      date: '2026-05-08',
      linesAdded: 312,
      message: 'chapter 3 draft',
    });
    expect(parsed.source).toBe('book_commit');
    if (parsed.source === 'book_commit') {
      expect(parsed.linesAdded).toBe(312);
    }
  });

  test('parses a gh_repo_created event', () => {
    const parsed = Event.parse({
      id: 'gh:marcelsamyn/foo',
      source: 'gh_repo_created',
      date: '2026-05-08',
      name: 'foo',
      url: 'https://github.com/marcelsamyn/foo',
    });
    expect(parsed.source).toBe('gh_repo_created');
  });

  test('parses a code_commit event', () => {
    const parsed = Event.parse({
      id: 'code:foo/bar:abc123',
      source: 'code_commit',
      date: '2026-05-08',
      repo: 'foo/bar',
      message: 'fix: typo',
      url: 'https://github.com/foo/bar/commit/abc123',
    });
    expect(parsed.source).toBe('code_commit');
    if (parsed.source === 'code_commit') {
      expect(parsed.repo).toBe('foo/bar');
    }
  });

  test('rejects unknown source', () => {
    expect(() =>
      Event.parse({ id: 'x', source: 'unknown', date: '2026-05-08' })
    ).toThrow();
  });

  test('rejects malformed date', () => {
    expect(() =>
      Event.parse({ id: 'x', source: 'ig_post', date: 'yesterday' })
    ).toThrow();
  });
});

describe('Source schema', () => {
  test('parses a source entry', () => {
    const parsed = Source.parse({
      id: 'youtube_long',
      label: 'YouTube long-form',
      group: 'video',
      defaultEnabled: true,
      color: 'oklch(0.7 0.18 25)',
    });
    expect(parsed.id).toBe('youtube_long');
  });
});
