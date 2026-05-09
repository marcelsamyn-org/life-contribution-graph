import type { Event } from '../../app/src/lib/schema';
import { fetchJson } from './lib/http';
import { toLocalDate } from './lib/timezone';

const SHORT_THRESHOLD_SEC = 180;

type PlaylistItem = {
  snippet: {
    resourceId: { videoId: string };
    publishedAt: string;
    title: string;
  };
};

type VideoItem = {
  id: string;
  contentDetails: { duration: string };
};

export function parseIso8601Duration(d: string): number {
  // YouTube returns e.g. "PT1H2M3S"; H/M/S are optional.
  const m = d.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, h, mi, s] = m;
  return (Number(h ?? 0) * 3600) + (Number(mi ?? 0) * 60) + Number(s ?? 0);
}

export function classifyVideos(
  playlistItems: PlaylistItem[],
  videoItems: VideoItem[],
): Event[] {
  const durations = new Map(
    videoItems.map((v) => [v.id, parseIso8601Duration(v.contentDetails.duration)]),
  );
  return playlistItems.flatMap((item): Event[] => {
    const id = item.snippet.resourceId.videoId;
    const sec = durations.get(id);
    if (sec === undefined) return [];
    const source = sec <= SHORT_THRESHOLD_SEC ? 'youtube_short' : 'youtube_long';
    return [{
      id: `yt:${id}`,
      source,
      date: toLocalDate(item.snippet.publishedAt),
      durationSec: sec,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${id}`,
    }];
  });
}

async function fetchUploadsPlaylistId(channelId: string, apiKey: string): Promise<string> {
  type Resp = { items: { contentDetails: { relatedPlaylists: { uploads: string } } }[] };
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
  const data = await fetchJson<Resp>(url);
  const id = data.items[0]?.contentDetails.relatedPlaylists.uploads;
  if (!id) throw new Error(`no uploads playlist for channel ${channelId}`);
  return id;
}

async function fetchAllPlaylistItems(playlistId: string, apiKey: string): Promise<PlaylistItem[]> {
  type Resp = { items: PlaylistItem[]; nextPageToken?: string };
  const out: PlaylistItem[] = [];
  let pageToken: string | undefined;
  do {
    const url =
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}` +
      `&maxResults=50&key=${apiKey}` + (pageToken ? `&pageToken=${pageToken}` : '');
    const data = await fetchJson<Resp>(url);
    out.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

async function fetchVideoDurations(ids: string[], apiKey: string): Promise<VideoItem[]> {
  type Resp = { items: VideoItem[] };
  const out: VideoItem[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch.join(',')}&key=${apiKey}`;
    const data = await fetchJson<Resp>(url);
    out.push(...data.items);
  }
  return out;
}

export async function fetchYoutubeEvents(): Promise<Event[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!apiKey || !channelId) {
    throw new Error('YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID env vars are required');
  }
  const uploadsId = await fetchUploadsPlaylistId(channelId, apiKey);
  const items = await fetchAllPlaylistItems(uploadsId, apiKey);
  const videoIds = items.map((i) => i.snippet.resourceId.videoId);
  const videos = await fetchVideoDurations(videoIds, apiKey);
  return classifyVideos(items, videos);
}
