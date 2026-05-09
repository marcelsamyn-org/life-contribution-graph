export type Range = {
  start: string; // YYYY-MM-DD, inclusive
  end: string; // YYYY-MM-DD, inclusive
  label: string;
};

function shiftDays(yyyymmdd: string, deltaDays: number): string {
  const [y, m, d] = yyyymmdd.split('-').map((s) => Number.parseInt(s, 10)) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

export function rollingRange(today: string, days = 365): Range {
  return {
    start: shiftDays(today, -(days - 1)),
    end: today,
    label: `last ${days} days`,
  };
}

export function calendarYearRange(year: number): Range {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    label: String(year),
  };
}
