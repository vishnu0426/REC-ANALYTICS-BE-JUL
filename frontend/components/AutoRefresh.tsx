"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-runs the surrounding server component every `intervalMs` while `active`
 * (i.e. some call is still uploaded/validating/processing), so statuses
 * update without a manual browser refresh. Idle once everything is terminal,
 * and paused while the tab is hidden.
 */
export default function AutoRefresh({ active, intervalMs = 4000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
