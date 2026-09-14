import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

type Day = { day: string; matches: number };

const PLOT_HEIGHT = 'h-40';
const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** 1, 2 ou 5 × 10ⁿ : graduations rondes. */
function niceStep(raw: number) {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
}

function scale(max: number) {
  const step = max <= 4 ? 1 : Math.max(1, niceStep(max / 4));
  const top = Math.max(4, step * Math.ceil(max / step));
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, index) => index * step);
  return { top, ticks };
}

const plural = (count: number) => `${formatNumber(count)} partie${count > 1 ? 's' : ''}`;
const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const fullDay = (day: string) => longDate.format(new Date(`${day}T00:00:00Z`));

/**
 * Série unique, donc une seule couleur et pas de légende : le titre la nomme.
 * Colonnes fines ancrées à la ligne de base, pic annoté, infobulle au survol et
 * au focus clavier (CSS seul, aucune hydratation), et tableau équivalent.
 */
export function ActivityChart({ days, title, subtitle }: { days: Day[]; title: string; subtitle: string }) {
  const max = Math.max(0, ...days.map((entry) => entry.matches));
  const total = days.reduce((sum, entry) => sum + entry.matches, 0);
  const peak = max > 0 ? days.findLastIndex((entry) => entry.matches === max) : -1;
  const { top, ticks } = scale(max);
  const percent = (value: number) => `${(value / top) * 100}%`;

  return (
    <figure className="rounded-lg border border-line bg-panel p-4 md:p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-fg">{title}</h2>
          <p className="text-xs text-subtle">{subtitle}</p>
        </div>
        <p className="text-xs text-muted">
          <span className="font-medium text-fg">{formatNumber(total)}</span> sur la période
        </p>
      </figcaption>

      <div className="mt-6 flex gap-3" aria-hidden={false}>
        <div className={cn('relative w-7 shrink-0 text-right text-2xs tabular-nums text-subtle', PLOT_HEIGHT)} aria-hidden>
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: percent(tick) }}>
              {formatNumber(tick)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className={cn('relative', PLOT_HEIGHT)}>
            {ticks.map((tick) => (
              <div
                key={tick}
                aria-hidden
                className={cn('absolute inset-x-0 border-t', tick === 0 ? 'border-line-strong' : 'border-line')}
                style={{ bottom: percent(tick) }}
              />
            ))}

            <ol className="absolute inset-0 flex items-end gap-0.5" aria-label={title}>
              {days.map((entry, index) => {
                const align =
                  index < 3 ? 'left-0' : index > days.length - 4 ? 'right-0' : 'left-1/2 -translate-x-1/2';
                return (
                  <li
                    key={entry.day}
                    tabIndex={0}
                    aria-label={`${fullDay(entry.day)} : ${plural(entry.matches)}`}
                    className="group relative flex h-full flex-1 cursor-default items-end justify-center rounded-sm outline-none focus-visible:bg-white/[0.03]"
                  >
                    <span
                      aria-hidden
                      className="w-full max-w-6 rounded-t-[4px] bg-accent transition-[filter] duration-100 group-hover:brightness-125 group-focus-visible:brightness-125"
                      style={{ height: percent(entry.matches) }}
                    />
                    {index === peak ? (
                      <span
                        aria-hidden
                        className="absolute text-2xs font-medium tabular-nums text-muted group-hover:opacity-0 group-focus-visible:opacity-0"
                        style={{ bottom: `calc(${percent(entry.matches)} + 4px)` }}
                      >
                        {formatNumber(entry.matches)}
                      </span>
                    ) : null}
                    <span
                      role="tooltip"
                      className={cn(
                        'pointer-events-none absolute z-10 hidden whitespace-nowrap rounded-md border border-line-strong bg-elevated px-2.5 py-1.5 shadow-lg shadow-black/40 group-hover:block group-focus-visible:block',
                        align,
                      )}
                      style={{ bottom: `calc(${percent(entry.matches)} + 8px)` }}
                    >
                      <span className="block text-sm font-semibold text-fg">{plural(entry.matches)}</span>
                      <span className="block text-2xs text-muted first-letter:uppercase">{fullDay(entry.day)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="mt-2 flex gap-0.5 text-2xs tabular-nums text-subtle" aria-hidden>
            {days.map((entry, index) => (
              <span key={entry.day} className="flex-1 text-center">
                {(days.length - 1 - index) % 2 === 0 ? shortDay(entry.day) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-4 group/table">
        <summary className="cursor-pointer text-xs text-muted transition-colors select-none hover:text-fg">
          Afficher les données
        </summary>
        <div className="mt-3 max-h-64 overflow-auto rounded-md border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-subtle">
                <th className="px-3 py-2 font-normal">Jour</th>
                <th className="px-3 py-2 text-right font-normal">Parties</th>
              </tr>
            </thead>
            <tbody>
              {days.map((entry) => (
                <tr key={entry.day} className="border-t border-line">
                  <td className="px-3 py-1.5 text-muted first-letter:uppercase">{fullDay(entry.day)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-fg">{formatNumber(entry.matches)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
