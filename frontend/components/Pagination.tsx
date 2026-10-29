import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  pageSize,
  total,
  basePath,
  extraParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  /** Additional query params (e.g. active filters) to preserve across page links. */
  extraParams?: Record<string, string | undefined>;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(extraParams ?? {})) {
      if (v) params.set(k, v);
    }
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between mt-4 text-[13px] text-muted">
      <span>
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={hrefFor(page - 1)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-hairline hover:bg-panel/70 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-hairline text-faint">
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </span>
        )}
        <span className="px-2 tabular">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <Link
            href={hrefFor(page + 1)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-hairline hover:bg-panel/70 transition-colors"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-hairline text-faint">
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}
