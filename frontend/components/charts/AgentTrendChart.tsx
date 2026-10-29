"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { CallSummary } from "@/lib/api";

export default function AgentTrendChart({ calls }: { calls: CallSummary[] }) {
  const data = calls
    .filter((c) => c.overall_qa_score != null && c.call_date)
    .slice()
    .sort((a, b) => new Date(a.call_date!).getTime() - new Date(b.call_date!).getTime())
    .map((c) => ({
      date: new Date(c.call_date!).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      score: c.overall_qa_score,
    }));

  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6C7488" }} axisLine={{ stroke: "#E2E5EC" }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6C7488" }} axisLine={false} tickLine={false} width={28} />
        <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E5EC", borderRadius: 6, fontSize: 12 }} />
        <Line type="monotone" dataKey="score" stroke="#2F6FED" strokeWidth={2} dot={{ r: 3, fill: "#2F6FED" }} name="QA score" />
      </LineChart>
    </ResponsiveContainer>
  );
}
