"use client";

import { LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea, ResponsiveContainer, Tooltip } from "recharts";
import { SentimentTimelinePoint } from "@/lib/api";

export default function SentimentTimelineChart({ timeline }: { timeline: SentimentTimelinePoint[] }) {
  if (timeline.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={timeline} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <ReferenceArea y1={0} y2={1} fill="#12805A" fillOpacity={0.06} />
        <ReferenceArea y1={-1} y2={0} fill="#C1352E" fillOpacity={0.06} />
        <ReferenceLine y={0} stroke="#E2E5EC" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`}
          tick={{ fontSize: 11, fill: "#6C7488" }}
          axisLine={{ stroke: "#E2E5EC" }}
          tickLine={false}
        />
        <YAxis domain={[-1, 1]} tick={{ fontSize: 11, fill: "#6C7488" }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E5EC", borderRadius: 6, fontSize: 12 }}
          labelFormatter={(t) => `${Math.floor(Number(t) / 60)}:${String(Math.floor(Number(t) % 60)).padStart(2, "0")}`}
          formatter={(value: number, _name, item) => [item?.payload?.label ?? value, "sentiment"]}
        />
        <Line type="monotone" dataKey="score" stroke="#4B5468" strokeWidth={2} dot={{ r: 2.5, fill: "#4B5468" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
