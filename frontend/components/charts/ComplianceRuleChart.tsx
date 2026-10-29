"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { ComplianceRuleBreakdown } from "@/lib/api";

export default function ComplianceRuleChart({ data }: { data: ComplianceRuleBreakdown[] }) {
  if (data.length === 0) return null;
  const sorted = data.slice().sort((a, b) => b.count - a.count).slice(0, 10);

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, sorted.length * 32)}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: "#6C7488" }} axisLine={{ stroke: "#E2E5EC" }} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="rule_code"
          tick={{ fontSize: 11, fill: "#4B5468" }}
          axisLine={false}
          tickLine={false}
          width={200}
        />
        <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E5EC", borderRadius: 6, fontSize: 12 }} />
        <Bar dataKey="count" fill="#2F6FED" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
