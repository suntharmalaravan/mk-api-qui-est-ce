import type { Route } from 'next';
import Link from 'next/link';

/**
 * Tuile KPI : libellé, valeur (chiffres proportionnels, jamais tabular-nums à
 * cette taille), détail facultatif en encre de texte.
 */
export function StatTile({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
  href?: Route;
}) {
  const content = (
    <dl>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold tracking-tight text-fg">{value}</dd>
      {detail ? <dd className="mt-1 text-xs text-subtle">{detail}</dd> : null}
    </dl>
  );

  const frame = 'block rounded-lg border border-line bg-panel p-4';
  return href ? (
    <Link href={href} className={`${frame} transition-colors hover:border-line-strong hover:bg-white/[0.015]`}>
      {content}
    </Link>
  ) : (
    <div className={frame}>{content}</div>
  );
}
