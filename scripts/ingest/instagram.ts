import type { Event } from '../../app/src/lib/schema';
import { fetchJson } from './lib/http';
import { toLocalDate } from './lib/timezone';

type Media = {
  id: string;
  media_type: 'VIDEO' | 'IMAGE' | 'CAROUSEL_ALBUM';
  media_product_type: 'REELS' | 'FEED';
  timestamp: string;
  permalink: string;
  caption?: string;
};

type Story = {
  id: string;
  timestamp: string;
  permalink: string;
};

export function mediaToEvents(items: Media[]): Event[] {
  return items.map((m): Event => {
    if (m.media_product_type === 'REELS') {
      return {
        id: `ig:${m.id}`,
        source: 'ig_reel',
        date: toLocalDate(m.timestamp),
        durationSec: 0,
        url: m.permalink,
      };
    }
    return {
      id: `ig:${m.id}`,
      source: 'ig_post',
      date: toLocalDate(m.timestamp),
      url: m.permalink,
      caption: m.caption,
    };
  });
}

export function storiesToEvents(items: Story[]): Event[] {
  return items.map((s): Event => ({
    id: `ig:story:${s.id}`,
    source: 'ig_story',
    date: toLocalDate(s.timestamp),
    url: s.permalink,
  }));
}

async function fetchAllMedia(userId: string, token: string): Promise<Media[]> {
  type Resp = { data: Media[]; paging?: { next?: string } };
  const fields = 'id,media_type,media_product_type,timestamp,permalink,caption';
  let url: string | undefined =
    `https://graph.instagram.com/v22.0/${userId}/media?fields=${fields}&access_token=${token}`;
  const out: Media[] = [];
  while (url) {
    const data = await fetchJson<Resp>(url);
    out.push(...data.data);
    url = data.paging?.next ?? undefined;
  }
  return out;
}

async function fetchStories(userId: string, token: string): Promise<Story[]> {
  type Resp = { data: Story[] };
  const url =
    `https://graph.instagram.com/v22.0/${userId}/stories?fields=id,timestamp,permalink&access_token=${token}`;
  const data = await fetchJson<Resp>(url);
  return data.data;
}

export async function fetchInstagramEvents(): Promise<Event[]> {
  const userId = process.env.IG_USER_ID;
  const token = process.env.IG_LONG_LIVED_TOKEN;
  if (!userId || !token) {
    throw new Error('IG_USER_ID and IG_LONG_LIVED_TOKEN env vars are required');
  }
  const [media, stories] = await Promise.all([
    fetchAllMedia(userId, token),
    fetchStories(userId, token),
  ]);
  return [...mediaToEvents(media), ...storiesToEvents(stories)];
}
