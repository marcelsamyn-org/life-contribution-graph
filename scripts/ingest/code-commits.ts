import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Event } from '../../app/src/lib/schema';
import { fetchJson } from './lib/http';
import { toLocalDate } from './lib/timezone';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_LIST_PATH = resolve(here, '../../data/code-repos.json');

type GhCommit = {
  sha: string;
  html_url: string;
  commit: {
    author: { date: string } | null;
    message: string;
  };
  author: { login: string } | null;
};

export function commitsToEvents(repo: string, commits: GhCommit[]): Event[] {
  return commits.flatMap((c): Event[] => {
    const isoDate = c.commit.author?.date;
    if (!isoDate) return [];
    return [
      {
        id: `code:${repo}:${c.sha}`,
        source: 'code_commit',
        date: toLocalDate(isoDate),
        repo,
        message: c.commit.message.split('\n', 1)[0],
        url: c.html_url,
      },
    ];
  });
}

async function fetchRepoCommits(
  repo: string,
  authorLogin: string,
  token: string | undefined,
): Promise<Event[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'life-contribution-graph',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const out: Event[] = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/repos/${repo}/commits?author=${authorLogin}&per_page=100&page=${page}`;
    const batch = await fetchJson<GhCommit[]>(url, { headers });
    out.push(...commitsToEvents(repo, batch));
    if (batch.length < 100) break;
    page++;
    if (page > 20) break; // safety: 2000 commits per repo is enough
  }
  return out;
}

async function loadRepoList(): Promise<string[]> {
  try {
    const text = await readFile(REPO_LIST_PATH, 'utf-8');
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error('data/code-repos.json must be a JSON array of "owner/repo" strings');
    }
    return parsed.filter((s): s is string => typeof s === 'string');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export async function fetchCodeCommitEvents(): Promise<Event[]> {
  const authorLogin = process.env.GH_AUTHOR_LOGIN;
  if (!authorLogin) {
    throw new Error('GH_AUTHOR_LOGIN env var is required (your GitHub login)');
  }
  const token = process.env.GH_INGEST_PAT;
  const repos = await loadRepoList();
  if (repos.length === 0) return [];
  const perRepo = await Promise.all(repos.map((r) => fetchRepoCommits(r, authorLogin, token)));
  return perRepo.flat();
}
