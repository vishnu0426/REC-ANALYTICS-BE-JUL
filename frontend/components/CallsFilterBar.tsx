"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "uploaded", label: "Uploaded" },
  { value: "validating", label: "Validating" },
  { value: "processing", label: "Processing" },
  { value: "processed", label: "Processed" },
  { value: "failed", label: "Failed" },
];

const RISK_OPTIONS = [
  { value: "", label: "All risk levels" },
  { value: "low", label: "Low risk" },
  { value: "medium", label: "Medium risk" },
  { value: "high", label: "High risk" },
];

const SELECT_CLASS =
  "text-[13px] border border-hairline rounded-md px-2.5 py-1.5 bg-panel text-ink hover:border-accent/50 transition-colors focus:outline-none focus:ring-1 focus:ring-accent";

export default function CallsFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "";
  const riskLevel = searchParams.get("risk_level") ?? "";
  const hasFilters = status !== "" || riskLevel !== "";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Any filter change invalidates the current page's meaning -- always
    // land back on page 1 rather than risk landing past the end of a
    // suddenly-shorter filtered result set.
    params.delete("page");
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      <select
        aria-label="Filter by status"
        className={SELECT_CLASS}
        value={status}
        onChange={(e) => updateFilter("status", e.target.value)}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by risk level"
        className={SELECT_CLASS}
        value={riskLevel}
        onChange={(e) => updateFilter("risk_level", e.target.value)}
      >
        {RISK_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hasFilters && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="text-[13px] text-muted hover:text-ink transition-colors px-2 py-1.5"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
