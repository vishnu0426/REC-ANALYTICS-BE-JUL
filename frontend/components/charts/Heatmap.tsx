"use client";

import { useState } from "react";
import { HeatmapCell } from "@/lib/api";

/**
 * Generic grid heatmap used by the Analytics page (volume day×hour,
 * agent×criteria, category×weekday). Color does one job per instance:
 *  - "sequential": magnitude, one blue ramp light→dark
 *  - "diverging":  a 0-100 score around a midpoint, red ↔ neutral gray ↔ green
 * Cells keep a 2px surface gap; exact values live in the hover tooltip (and
 * optionally inside the cell via `showValues`), so color is never the only
 * channel.
 */

const SEQ_STOPS = ["#E8EFFD", "#BDD3FA", "#8FB3F5", "#5E90F0", "#2F6FED", "#1D4FBF"];
const DIV_LOW = "#C1352E";
const DIV_MID = "#E4E7ED";
const DIV_HIGH = "#12805A";

function hexLerp(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return (
    "#" +
    pa
      .map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0"))
      .join("")
  );
}

function sequentialColor(t: number): string {
  const pos = Math.max(0, Math.min(1, t)) * (SEQ_STOPS.length - 1);
  const i = Math.min(Math.floor(pos), SEQ_STOPS.length - 2);
  return hexLerp(SEQ_STOPS[i], SEQ_STOPS[i + 1], pos - i);
}

function divergingColor(value: number, midpoint: number, max: number): string {
  if (value <= midpoint) return hexLerp(DIV_MID, DIV_LOW, (midpoint - value) / midpoint);
  return hexLerp(DIV_MID, DIV_HIGH, (value - midpoint) / (max - midpoint));
}

// Ink or white label inside a fill, picked by fill luminance so text always clears contrast.
function labelColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? "#171B24" : "#FFFFFF";
}

export default function Heatmap({
  cells,
  rows,
  cols,
  scale = "sequential",
  midpoint = 70,
  max = 100,
  colTickEvery = 1,
  showValues = false,
  valueSuffix = "",
}: {
  cells: HeatmapCell[];
  rows?: string[];
  cols?: string[];
  scale?: "sequential" | "diverging";
  midpoint?: number;
  max?: number;
  colTickEvery?: number;
  showValues?: boolean;
  valueSuffix?: string;
}) {
  const [hover, setHover] = useState<{ cell: HeatmapCell; x: number; y: number } | null>(null);

  const rowKeys = rows ?? [...new Set(cells.map((c) => c.row))];
  const colKeys = cols ?? [...new Set(cells.map((c) => c.col))];
  const byKey = new Map(cells.map((c) => [`${c.row}\u0000${c.col}`, c]));
  const values = cells.map((c) => c.value ?? 0);
  const seqMax = Math.max(1, ...values);

  if (cells.length === 0) {
    return <div className="text-[12.5px] text-muted py-6 text-center">No data yet.</div>;
  }

  const fill = (cell: HeatmapCell | undefined): string | null => {
    if (!cell || cell.value == null) return null;
    return scale === "diverging"
      ? divergingColor(cell.value, midpoint, max)
      : sequentialColor(cell.value / seqMax);
  };

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-1">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <tbody>
            {rowKeys.map((row) => (
              <tr key={row}>
                <td className="pr-2 text-right text-[11px] text-muted whitespace-nowrap align-middle">
                  {row}
                </td>
                {colKeys.map((col) => {
                  const cell = byKey.get(`${row}\u0000${col}`);
                  const bg = fill(cell);
                  return (
                    <td key={col} className="p-0">
                      <div
                        className="rounded-[3px] flex items-center justify-center font-mono text-[10px] tabular"
                        style={{
                          width: showValues ? 44 : 22,
                          height: showValues ? 28 : 22,
                          background: bg ?? "#F1F3F7",
                          color: bg ? labelColor(bg) : undefined,
                          opacity: bg ? 1 : 0.55,
                        }}
                        onMouseEnter={(e) => {
                          if (!cell) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHover({ cell, x: rect.left + rect.width / 2, y: rect.top });
                        }}
                        onMouseLeave={() => setHover(null)}
                      >
                        {showValues && cell?.value != null ? Math.round(cell.value) : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td />
              {colKeys.map((col, i) => (
                <td key={col} className="pt-1 p-0">
                  {/* Fixed width + ellipsis so a long label ("identity_verification")
                      can't widen its whole column and open gaps in the grid. */}
                  <div
                    className="text-center text-[10px] text-faint truncate mx-auto"
                    style={{ width: showValues ? 44 : 22 }}
                    title={col}
                  >
                    {i % colTickEvery === 0 ? col.replace(/_/g, " ") : ""}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-2 text-[10.5px] text-faint">
        {scale === "diverging" ? (
          <>
            <span>{`0${valueSuffix}`}</span>
            <div
              className="h-2 w-28 rounded-full"
              style={{ background: `linear-gradient(to right, ${DIV_LOW}, ${DIV_MID}, ${DIV_HIGH})` }}
            />
            <span>{`${max}${valueSuffix}`}</span>
            <span className="ml-1">midpoint {midpoint}</span>
          </>
        ) : (
          <>
            <span>0</span>
            <div
              className="h-2 w-28 rounded-full"
              style={{ background: `linear-gradient(to right, ${SEQ_STOPS[0]}, ${SEQ_STOPS[SEQ_STOPS.length - 1]})` }}
            />
            <span>{seqMax}{valueSuffix}</span>
          </>
        )}
      </div>

      {hover && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full pointer-events-none bg-panel border border-hairline rounded-md px-2.5 py-1.5 text-[11.5px] shadow-sm"
          style={{ left: hover.x, top: hover.y - 6 }}
        >
          <span className="text-muted">{hover.cell.row} · {hover.cell.col}</span>
          <span className="font-mono tabular text-ink ml-2">
            {hover.cell.value != null ? Math.round(hover.cell.value * 10) / 10 : "—"}
            {valueSuffix}
          </span>
          {scale === "diverging" && <span className="text-faint ml-1.5">({hover.cell.n} scored)</span>}
        </div>
      )}
    </div>
  );
}
