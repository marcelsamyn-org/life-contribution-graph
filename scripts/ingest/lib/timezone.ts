import { formatInTimeZone } from 'date-fns-tz';

export const LOCAL_TZ = process.env.LOCAL_TZ ?? 'Europe/Brussels';

export function toLocalDate(iso: string): string {
  return formatInTimeZone(new Date(iso), LOCAL_TZ, 'yyyy-MM-dd');
}
