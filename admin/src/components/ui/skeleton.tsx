import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-white/[0.05]', className)} />;
}

export function TableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Chargement">
      <div className="h-9 border-b border-line" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex h-11 items-center gap-4 border-b border-line px-4 md:px-6">
          <Skeleton className="size-[22px] rounded-full" />
          <Skeleton className="h-3 w-44" />
          <Skeleton className="ml-auto h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="hidden h-3 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div role="status" aria-label="Chargement" className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          <Skeleton className="aspect-[3/4] rounded-lg" />
          <Skeleton className="mt-2 h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
