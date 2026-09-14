import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <>
      <PageHeader title="Chargement…" />
      <div className="mx-auto w-full max-w-[1080px] px-4 py-8 md:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[98px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="mt-6 h-[292px] rounded-lg" />
      </div>
    </>
  );
}
