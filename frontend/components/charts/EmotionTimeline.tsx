"use client";

import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { EmotionTimelinePoint } from "@/lib/api";

// Fixed slot order/colors — never reassign, so the same emotion always reads
// as the same color across calls.
const EMOTION_COLOR: Record<string, string> = {
  neutral: "#2a78d6",
  satisfied: "#1baf7a",
  frustrated: "#eda100",
  confused: "#008300",
  anxious: "#4a3aa7",
  angry: "#e34948",
};

export default function EmotionTimeline({ timeline }: { timeline: EmotionTimelinePoint[] }) {
  if (timeline.length === 0) return null;
  const data = timeline.map((p) => ({ ...p, y: 0 }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={70}>
        <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <XAxis
            type="number"
            dataKey="timestamp"
            tickFormatter={(t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`}
            tick={{ fontSize: 11, fill: "#6C7488" }}
            axisLine={{ stroke: "#E2E5EC" }}
            tickLine={false}
          />
          <YAxis type="number" dataKey="y" domain={[-1, 1]} hide />
          <ZAxis range={[80, 80]} />
          <Tooltip
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E5EC", borderRadius: 6, fontSize: 12 }}
            formatter={(_value, _name, item: any) => [item?.payload?.emotion, "emotion"]}
            labelFormatter={() => ""}
          />
          <Scatter data={data}>
            {data.map((d, i) => (
              <Cell key={i} fill={EMOTION_COLOR[d.emotion] || "#6C7488"} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      {/* Always-visible legend — 2 of the 6 emotion colors fall below 3:1
          contrast on white, so labels can't be hover-only. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted mt-1">
        {Object.entries(EMOTION_COLOR).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: v }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}
