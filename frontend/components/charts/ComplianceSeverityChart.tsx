"use client";

import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";

// Severity is ordinal (low -> critical), not the good/warn/bad pass-fail
// triad — a violation is never "good" at any severity — so this is a
// single-hue monotone-lightness ramp, anchored at `bad` for "critical".
const SEVERITY_ORDER = ["low", "medium", "high", "critical"];
const SEVERITY_COLOR: Record<string, string> = {
  low: "#E39793",
  medium: "#D67D75",
  high: "#C9635A",
  critical: "#C1352E",
};

export default function ComplianceSeverityChart({ bySeverity }: { bySeverity: Record<string, number> }) {
  const data = SEVERITY_ORDER.filter((s) => bySeverity[s] != null).map((s) => ({ severity: s, count: bySeverity[s] }));
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <XAxis dataKey="severity" tick={{ fontSize: 11, fill: "#6C7488" }} axisLine={{ stroke: "#E2E5EC" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#6C7488" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E5EC", borderRadius: 6, fontSize: 12 }} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.severity} fill={SEVERITY_COLOR[d.severity]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
