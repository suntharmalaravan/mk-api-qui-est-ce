import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <>
      <div className="flex h-12 items-center border-b border-line px-4 md:px-6">
        <Skeleton className="h-3.5 w-40" />
      </div>
      <div className="mx-auto w-full max-w-[1080px] px-4 py-8 md:px-8">
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-3 h-8 w-72" />
          </div>
        </div>
        <Skeleton className="mt-8 h-[190px] rounded-lg" />
        <Skeleton className="mt-10 h-40 rounded-lg" />
      </div>
    </>
  );
}
