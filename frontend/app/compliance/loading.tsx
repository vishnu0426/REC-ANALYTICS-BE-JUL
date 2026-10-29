import PageContainer from "@/components/PageContainer";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="h-6 w-32 mb-2" />
      <Skeleton className="h-4 w-80 mb-7" />
      <div className="flex flex-wrap gap-3 mb-7">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} className="flex-1 min-w-[150px]" />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    </PageContainer>
  );
}
