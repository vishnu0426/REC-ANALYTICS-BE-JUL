"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer,
} from "recharts";

/**
 * Dominant customer emotion across processed calls. Nominal categories, so
 * every bar wears the same slot-1 hue — bar length carries the value, direct
 * labels at the tips carry the exact counts.
 */
export default function EmotionDistributionChart({ distribution }: { distribution: Record<string, number> }) {
  const data = Object.entries(distribution)
    .map(([emotion, count]) => ({ emotion, count }))
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) {
    return <div className="text-[12.5px] text-muted py-6 text-center">No emotion data yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 30 + 20)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="emotion"
          width={92}
          tick={{ fontSize: 11.5, fill: "#4B5468" }}
          axisLine={{ stroke: "#E2E5EC" }}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "#F1F3F7" }}
          contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E5EC", borderRadius: 6, fontSize: 12 }}
          formatter={(value: number) => [value, "calls"]}
        />
        <Bar dataKey="count" fill="#2F6FED" barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "#4B5468" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
