import type { Range } from './range';
import type { Event } from './schema';

export type Fact = (events: Event[], range: Range) => string | null;

const inRange = (events: Event[], range: Range): Event[] =>
  events.filter((e) => e.date >= range.start && e.date <= range.end);

const fmt = (n: number): string => n.toLocaleString();

const countFact: Fact = (events, range) => {
  const inR = inRange(events, range);
  if (inR.length === 0) return null;
  return `${fmt(inR.length)} gifts in ${range.label}`;
};

const longFormHoursFact: Fact = (events, range) => {
  const longs = inRange(events, range).filter((e) => e.source === 'youtube_long');
  if (longs.length === 0) return null;
  const totalSec = longs.reduce((s, e) => s + ('durationSec' in e ? e.durationSec : 0), 0);
  const hours = Math.round(totalSec / 3600);
  return `${hours} hours of long-form video`;
};

const bookDaysFact: Fact = (events, range) => {
  const days = new Set(
    inRange(events, range)
      .filter((e) => e.source === 'book_commit')
      .map((e) => e.date),
  );
  if (days.size === 0) return null;
  return `${days.size} days at the book in ${range.label}`;
};

const longestPauseFact: Fact = (events, range) => {
  const dates = inRange(events, range)
    .map((e) => e.date)
    .sort();
  if (dates.length < 2) return null;
  let maxGap = 0;
  for (let i = 1; i < dates.length; i++) {
    const a = new Date(dates[i - 1]!);
    const b = new Date(dates[i]!);
    const gap = Math.round((b.getTime() - a.getTime()) / 86_400_000);
    if (gap > maxGap) maxGap = gap;
  }
  if (maxGap < 2) return null;
  return `your quietest stretch: ${maxGap} days`;
};

const breakdownFact: Fact = (events, range) => {
  const inR = inRange(events, range);
  if (inR.length === 0) return null;
  const reels = inR.filter((e) => e.source === 'ig_reel').length;
  const posts = inR.filter((e) => e.source === 'ig_post').length;
  const stories = inR.filter((e) => e.source === 'ig_story').length;
  if (reels + posts + stories === 0) return null;
  return `${fmt(reels)} reels, ${fmt(posts)} posts, ${fmt(stories)} stories`;
};

const firstEventFact: Fact = (events, range) => {
  const dates = inRange(events, range)
    .map((e) => e.date)
    .sort();
  const first = dates[0];
  if (!first) return null;
  return `first gift in this view: ${first}`;
};

export const facts: Fact[] = [
  countFact,
  longFormHoursFact,
  bookDaysFact,
  longestPauseFact,
  breakdownFact,
  firstEventFact,
];
