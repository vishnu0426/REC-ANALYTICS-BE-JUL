export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-panelRaised rounded-md ${className}`} />;
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-panel border border-hairline rounded-lg px-5 py-4 ${className}`}>
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-hairline last:border-0">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-12" />
    </div>
  );
}
