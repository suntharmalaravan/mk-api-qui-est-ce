const TIME_ZONE = 'Europe/Paris';

const numberFormat = new Intl.NumberFormat('fr-FR');
const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
});
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: TIME_ZONE,
});
const relativeFormat = new Intl.RelativeTimeFormat('fr', { numeric: 'auto', style: 'short' });

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

export function formatNumber(value: number) {
  return numberFormat.format(value);
}

export function formatDate(date: Date) {
  return dateFormat.format(date);
}

export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date);
}

export function formatRelative(date: Date, now = Date.now()) {
  const seconds = Math.round((date.getTime() - now) / 1000);
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
  }
  return 'à l’instant';
}

/** `food_snacks` → `Food snacks` */
export function humanize(slug: string) {
  const text = slug.replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
