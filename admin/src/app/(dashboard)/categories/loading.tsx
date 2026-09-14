import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <>
      <PageHeader title="Catégories" />
      <div className="mx-auto w-full max-w-[920px] px-4 py-8 md:px-8">
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="mt-6 divide-y divide-line rounded-lg border border-line bg-panel">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-8 w-20" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="mt-2 h-3 w-48" />
              </div>
              <Skeleton className="h-[18px] w-[30px] rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
