import { z } from 'zod';

export const SourceId = z.enum([
  'youtube_long',
  'youtube_short',
  'ig_reel',
  'ig_post',
  'ig_story',
  'book_commit',
  'code_commit',
  'gh_repo_created',
]);
export type SourceId = z.infer<typeof SourceId>;

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

const VideoEvent = z.object({
  id: z.string().min(1),
  source: z.enum(['youtube_long', 'youtube_short', 'ig_reel']),
  date: DateString,
  durationSec: z.number().int().nonnegative(),
  title: z.string().optional(),
  url: z.string().url().optional(),
});

const PostEvent = z.object({
  id: z.string().min(1),
  source: z.enum(['ig_post', 'ig_story']),
  date: DateString,
  url: z.string().url().optional(),
  caption: z.string().optional(),
});

const CommitEvent = z.object({
  id: z.string().min(1),
  source: z.literal('book_commit'),
  date: DateString,
  linesAdded: z.number().int().nonnegative(),
  message: z.string().optional(),
});

const CodeCommitEvent = z.object({
  id: z.string().min(1),
  source: z.literal('code_commit'),
  date: DateString,
  repo: z.string().min(1),
  message: z.string().optional(),
  url: z.string().url().optional(),
});

const RepoEvent = z.object({
  id: z.string().min(1),
  source: z.literal('gh_repo_created'),
  date: DateString,
  name: z.string(),
  url: z.string().url(),
});

export const Event = z.discriminatedUnion('source', [
  VideoEvent,
  PostEvent,
  CommitEvent,
  CodeCommitEvent,
  RepoEvent,
]);
export type Event = z.infer<typeof Event>;

export const Source = z.object({
  id: SourceId,
  label: z.string().min(1),
  group: z.enum(['video', 'social', 'writing', 'code']),
  defaultEnabled: z.boolean(),
  color: z.string().min(1),
});
export type Source = z.infer<typeof Source>;
