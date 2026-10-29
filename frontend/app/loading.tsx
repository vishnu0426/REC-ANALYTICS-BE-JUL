import PageContainer from "@/components/PageContainer";
import { Skeleton, SkeletonCard, SkeletonRow } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="h-6 w-40 mb-2" />
      <Skeleton className="h-4 w-72 mb-7" />
      <div className="flex flex-wrap gap-3 mb-7">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="flex-1 min-w-[150px]" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-lg mb-7" />
      <div className="border border-hairline rounded-lg overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </PageContainer>
  );
}
