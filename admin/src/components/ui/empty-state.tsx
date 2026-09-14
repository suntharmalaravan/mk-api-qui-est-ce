import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-24 text-center">
      <span className="grid size-10 place-items-center rounded-lg border border-line bg-panel text-subtle">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-medium text-fg">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4 text-sm">{action}</div> : null}
    </div>
  );
}
