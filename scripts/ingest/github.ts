import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Event } from '../../app/src/lib/schema';
import { fetchJson } from './lib/http';
import { toLocalDate } from './lib/timezone';

const exec = promisify(execFile);

type RepoApi = { name: string; html_url: string; created_at: string; private: boolean };

export function reposToEvents(repos: RepoApi[]): Event[] {
  return repos
    .filter((r) => !r.private)
    .map((r): Event => ({
      id: `gh:${new URL(r.html_url).pathname.slice(1)}`,
      source: 'gh_repo_created',
      date: toLocalDate(r.created_at),
      name: r.name,
      url: r.html_url,
    }));
}

export function parseGitShortstat(text: string): Event[] {
  const events: Event[] = [];
  const blocks = text.split(/^commit /m).filter(Boolean);
  for (const block of blocks) {
    const sha = block.split('\n', 1)[0]?.trim();
    if (!sha) continue;
    const dateMatch = block.match(/^Date:\s+(.+)$/m);
    const messageMatch = block.match(/\n\n\s{4}(.+)\n/);
    const insertMatch = block.match(/(\d+) insertion/);
    if (!dateMatch || !insertMatch) continue;
    const linesAdded = Number.parseInt(insertMatch[1]!, 10);
    events.push({
      id: `book:${sha}`,
      source: 'book_commit',
      date: toLocalDate(new Date(dateMatch[1]!).toISOString()),
      linesAdded,
      message: messageMatch?.[1]?.trim(),
    });
  }
  return events;
}

async function fetchBookCommits(): Promise<Event[]> {
  const repoUrl = 'https://github.com/marcelsamyn-org/book.git';
  const author = process.env.GH_BOOK_AUTHOR ?? 'Marcel Samyn';
  const dir = await mkdtemp(join(tmpdir(), 'lcg-book-'));
  try {
    // `--bare` clones the full object DB without a working tree. Avoids partial-clone
    // promisor fetches, which break `git log --shortstat` (needs blobs to compute diffs).
    await exec('git', ['clone', '--bare', repoUrl, dir]);
    const { stdout } = await exec(
      'git',
      ['-C', dir, 'log', '--shortstat', '--date=iso-strict', `--author=${author}`, '--all'],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    return parseGitShortstat(stdout);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function fetchUserRepos(user: string, token: string | undefined): Promise<Event[]> {
  type Resp = RepoApi[];
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'life-contribution-graph',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const out: RepoApi[] = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/users/${user}/repos?per_page=100&page=${page}&type=owner&sort=created`;
    const batch = await fetchJson<Resp>(url, { headers });
    out.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return reposToEvents(out);
}

export async function fetchGithubEvents(): Promise<Event[]> {
  const token = process.env.GH_INGEST_PAT; // optional for public repos
  const [bookCommits, marcelRepos, orgRepos] = await Promise.all([
    fetchBookCommits(),
    fetchUserRepos('marcelsamyn', token),
    fetchUserRepos('marcelsamyn-org', token),
  ]);
  return [...bookCommits, ...marcelRepos, ...orgRepos];
}
