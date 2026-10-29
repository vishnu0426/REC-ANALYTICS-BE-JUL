import PageContainer from "@/components/PageContainer";
import { Skeleton, SkeletonRow } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="h-6 w-24 mb-2" />
      <Skeleton className="h-4 w-64 mb-7" />
      <div className="border border-hairline rounded-lg overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </PageContainer>
  );
}
