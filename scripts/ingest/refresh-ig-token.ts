import { execFileSync } from 'node:child_process';
import { fetchJson } from './lib/http';

type RefreshResp = { access_token: string; expires_in: number };

async function main(): Promise<void> {
  const token = process.env.IG_LONG_LIVED_TOKEN;
  if (!token) throw new Error('IG_LONG_LIVED_TOKEN not set');
  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`;
  const data = await fetchJson<RefreshResp>(url);
  if (!data.access_token) throw new Error('refresh did not return a token');

  execFileSync('gh', ['secret', 'set', 'IG_LONG_LIVED_TOKEN', '--body', data.access_token], {
    stdio: 'inherit',
    env: { ...process.env, GH_TOKEN: process.env.GH_PAT_FOR_SECRETS ?? process.env.GITHUB_TOKEN },
  });

  console.log(`refreshed; expires_in=${data.expires_in}s`);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
