import { Skeleton } from '@/components/ui/skeleton';

export default function CategoryLoading() {
  return (
    <div role="status" aria-label="Chargement des personnages" className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-3 h-4 w-32" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, index) => <Skeleton key={index} className="aspect-[3/4] rounded-lg" />)}
      </div>
    </div>
  );
}
