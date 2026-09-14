import { CardGridSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <>
      <div className="flex h-12 items-center border-b border-line px-4 md:px-6">
        <Skeleton className="h-3.5 w-40" />
      </div>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-5 h-8 w-80" />
        <div className="mt-8">
          <CardGridSkeleton />
        </div>
      </div>
    </>
  );
}
