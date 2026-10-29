"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { SentimentTrendDay } from "@/lib/api";

// Polarity scale: good/bad status hues with a true-neutral gray between them
// (the gray also separates red from green for CVD readers). Validated:
// adjacent ΔE ≥ 25, all ≥ 3:1 on white.
const COLORS = { positive: "#12805A", neutral: "#79839B", negative: "#C1352E" };

export default function SentimentTrendChart({ trend }: { trend: SentimentTrendDay[] }) {
  if (trend.length === 0) {
    return <div className="text-[12.5px] text-muted py-6 text-center">No calls in the last 30 days.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="day"
          tickFormatter={(d: string) => d.slice(5)}
          tick={{ fontSize: 11, fill: "#6C7488" }}
          axisLine={{ stroke: "#E2E5EC" }}
          tickLine={false}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6C7488" }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          cursor={{ fill: "#F1F3F7" }}
          contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E5EC", borderRadius: 6, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11.5, color: "#4B5468" }} iconType="circle" iconSize={7} />
        {/* white stroke = the surface gap between touching stack segments */}
        <Bar dataKey="positive" stackId="s" fill={COLORS.positive} stroke="#FFFFFF" strokeWidth={1} barSize={20} isAnimationActive={false} />
        <Bar dataKey="neutral" stackId="s" fill={COLORS.neutral} stroke="#FFFFFF" strokeWidth={1} barSize={20} isAnimationActive={false} />
        <Bar dataKey="negative" stackId="s" fill={COLORS.negative} stroke="#FFFFFF" strokeWidth={1} barSize={20} isAnimationActive={false} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
