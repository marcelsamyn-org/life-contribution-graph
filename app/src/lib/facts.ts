import type { Event } from './schema';

export type Fact = (events: Event[], year: number) => string | null;

const inYear = (events: Event[], year: number): Event[] =>
  events.filter((e) => e.date.startsWith(`${year}-`));

const fmt = (n: number): string => n.toLocaleString();

const countFact: Fact = (events, year) => {
  const inY = inYear(events, year);
  if (inY.length === 0) return null;
  return `${fmt(inY.length)} gifts this year`;
};

const longFormHoursFact: Fact = (events, year) => {
  const longs = inYear(events, year).filter((e) => e.source === 'youtube_long');
  if (longs.length === 0) return null;
  const totalSec = longs.reduce((s, e) => s + ('durationSec' in e ? e.durationSec : 0), 0);
  const hours = Math.round(totalSec / 3600);
  return `${hours} hours of long-form video`;
};

const bookDaysFact: Fact = (events, year) => {
  const days = new Set(
    inYear(events, year)
      .filter((e) => e.source === 'book_commit')
      .map((e) => e.date),
  );
  if (days.size === 0) return null;
  return `${days.size} days at the book this year`;
};

const longestPauseFact: Fact = (events, year) => {
  const dates = inYear(events, year)
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

const breakdownFact: Fact = (events, year) => {
  const inY = inYear(events, year);
  if (inY.length === 0) return null;
  const reels = inY.filter((e) => e.source === 'ig_reel').length;
  const posts = inY.filter((e) => e.source === 'ig_post').length;
  const stories = inY.filter((e) => e.source === 'ig_story').length;
  if (reels + posts + stories === 0) return null;
  return `${fmt(reels)} reels, ${fmt(posts)} posts, ${fmt(stories)} stories`;
};

const firstEventFact: Fact = (events, year) => {
  const inY = inYear(events, year).map((e) => e.date).sort();
  const first = inY[0];
  if (!first) return null;
  return `first gift of the year: ${first}`;
};

export const facts: Fact[] = [
  countFact,
  longFormHoursFact,
  bookDaysFact,
  longestPauseFact,
  breakdownFact,
  firstEventFact,
];
