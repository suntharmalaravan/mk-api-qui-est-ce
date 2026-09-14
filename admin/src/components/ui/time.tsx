import { formatDateTime, formatRelative } from '@/lib/format';

/** Date relative, date complète au survol. Rendu serveur uniquement. */
export function Time({ date, fallback = '—' }: { date: Date | null; fallback?: string }) {
  if (!date) return <span className="text-subtle">{fallback}</span>;
  return (
    <time dateTime={date.toISOString()} title={formatDateTime(date)}>
      {formatRelative(date)}
    </time>
  );
}
