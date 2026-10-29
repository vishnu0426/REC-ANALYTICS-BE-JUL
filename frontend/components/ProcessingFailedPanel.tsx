"use client";

import { useState } from "react";
import { AlertTriangle, RotateCw, Copy, ChevronDown } from "lucide-react";
import { api, CallSummary } from "@/lib/api";

const FALLBACK = {
  code: "UNEXPECTED_ERROR",
  title: "Processing failed",
  message: "Something went wrong while processing this recording.",
  action: "Retry. If it keeps failing, contact support with the reference ID.",
  retryable: true,
};

/**
 * Enterprise-style failure state: plain-language cause and next step up front,
 * a one-click retry, and the raw exception/traceback behind a disclosure so
 * support can still get at it without it being the headline.
 */
export default function ProcessingFailedPanel({
  call,
  onRetried,
}: {
  call: CallSummary;
  onRetried: () => void;
}) {
  const failure = call.failure ?? FALLBACK;
  const [busy, setBusy] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const retry = async () => {
    setBusy(true);
    setRetryError(null);
    try {
      await api.reprocessCall(call.id);
      onRetried();
    } catch (e: any) {
      setRetryError(e.message || "Retry failed");
      setBusy(false);
    }
  };

  const copyDetails = async () => {
    const text = `Reference: ${call.id}\nCode: ${failure.code}\n\n${call.failure_reason ?? ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (non-HTTPS origin) — details remain selectable */
    }
  };

  return (
    <div role="alert" className="bg-panel border border-hairline rounded-lg overflow-hidden">
      <div className="flex gap-4 px-6 py-5">
        <div className="w-9 h-9 rounded-full bg-bad/10 text-bad flex items-center justify-center shrink-0">
          <AlertTriangle className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[14px] font-semibold text-ink">{failure.title}</h2>
            <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded-sm border border-hairline text-muted">
              {failure.code}
            </span>
          </div>
          <p className="text-[13px] text-muted mt-1">{failure.message}</p>
          <p className="text-[13px] text-ink mt-2">
            <span className="font-medium">Next step: </span>
            {failure.action}
          </p>

          <div className="flex items-center gap-3 mt-4">
            {failure.retryable && (
              <button
                onClick={retry}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-60"
              >
                <RotateCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
                {busy ? "Retrying…" : "Retry processing"}
              </button>
            )}
            <span className="text-[11.5px] text-faint font-mono">Ref: {call.id}</span>
          </div>
          {retryError && <div className="text-bad text-[12px] mt-2">{retryError}</div>}
        </div>
      </div>

      {call.failure_reason && (
        <div className="border-t border-hairline">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="w-full flex items-center justify-between px-6 py-2.5 text-[12px] text-muted hover:bg-panelRaised"
          >
            Technical details
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="px-6 pb-4">
              <pre className="font-mono text-[11px] text-muted bg-panelRaised rounded-md p-3 max-h-60 overflow-auto whitespace-pre-wrap break-words">
                {call.failure_reason}
              </pre>
              <button
                onClick={copyDetails}
                className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-muted hover:text-ink"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? "Copied" : "Copy details for support"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
