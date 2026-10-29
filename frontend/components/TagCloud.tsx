"use client";

import { useState } from "react";
import { KeywordStat } from "@/lib/api";

/**
 * Free-form terms & phrases cloud ("Discover Trends" style): bare words, no
 * chips. Size carries frequency (√ scale); the word's color carries average
 * call sentiment. Colors are the validated status pair with a dark-gray
 * neutral so every word clears text contrast on white; the legend + hover
 * tooltip keep exact numbers available, so color is never the only channel.
 */

const WORD_COLOR = { positive: "#12805A", neutral: "#4B5468", negative: "#C1352E" };

function bucket(avg: number | null): keyof typeof WORD_COLOR {
  if (avg == null) return "neutral";
  if (avg >= 0.15) return "positive";
  if (avg <= -0.15) return "negative";
  return "neutral";
}

// Biggest terms land mid-cloud instead of a strict descending line.
function centerOut<T>(sorted: T[]): T[] {
  const out: T[] = [];
  sorted.forEach((item, i) => (i % 2 === 0 ? out.push(item) : out.unshift(item)));
  return out;
}

export default function TagCloud({ keywords }: { keywords: KeywordStat[] }) {
  const [hover, setHover] = useState<{ kw: KeywordStat; x: number; y: number } | null>(null);

  if (keywords.length === 0) {
    return (
      <div className="text-[12.5px] text-muted py-6 text-center">
        No keywords yet — they're extracted as calls are processed.
      </div>
    );
  }

  const maxCount = Math.max(...keywords.map((k) => k.count));
  const fontSize = (count: number) => 12 + 14 * Math.sqrt(count / maxCount);
  const arranged = centerOut([...keywords].sort((a, b) => b.count - a.count));

  return (
    <div className="relative h-full flex flex-col">
      <div className="flex-1 flex flex-wrap items-center justify-center content-center gap-x-4 gap-y-1.5 py-2 px-3">
        {arranged.map((kw) => {
          const tone = bucket(kw.avg_sentiment);
          return (
            <span
              key={kw.keyword}
              className="leading-tight cursor-default hover:opacity-70 transition-opacity whitespace-nowrap"
              style={{
                fontSize: fontSize(kw.count),
                color: WORD_COLOR[tone],
                fontWeight: kw.count === maxCount ? 600 : 450,
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHover({ kw, x: rect.left + rect.width / 2, y: rect.top });
              }}
              onMouseLeave={() => setHover(null)}
            >
              {kw.keyword}
            </span>
          );
        })}
      </div>

      <div className="flex justify-center gap-4 text-[10.5px] text-faint pt-1 border-t border-hairline/60">
        {(Object.entries(WORD_COLOR) as [string, string][]).map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
            mostly {label}
          </span>
        ))}
        <span>· size = frequency</span>
      </div>

      {hover && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full pointer-events-none bg-panel border border-hairline rounded-md px-2.5 py-1.5 text-[11.5px] shadow-sm whitespace-nowrap"
          style={{ left: hover.x, top: hover.y - 6 }}
        >
          <span className="text-ink font-medium">{hover.kw.keyword}</span>
          <span className="text-muted ml-2">{hover.kw.count} call{hover.kw.count === 1 ? "" : "s"}</span>
          {hover.kw.avg_sentiment != null && (
            <span className="text-faint ml-2">avg sentiment {hover.kw.avg_sentiment.toFixed(2)}</span>
          )}
        </div>
      )}
    </div>
  );
}
