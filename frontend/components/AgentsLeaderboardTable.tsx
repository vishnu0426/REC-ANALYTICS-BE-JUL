"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { AgentSummary, scoreColor } from "@/lib/api";
import EmptyState from "@/components/EmptyState";

type SortKey = "avg_qa_score" | "avg_health_score" | "call_count" | "violation_count";

export default function AgentsLeaderboardTable({ agents }: { agents: AgentSummary[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("avg_qa_score");
  const [desc, setDesc] = useState(true);

  if (agents.length === 0) {
    return (
      <EmptyState
        title="No agents yet"
        description="Agents are created automatically the first time a call is uploaded with an agent name attached."
      />
    );
  }

  const sorted = agents.slice().sort((a, b) => {
    const av = a[sortKey] ?? -1;
    const bv = b[sortKey] ?? -1;
    return desc ? bv - av : av - bv;
  });

  const sortButton = (key: SortKey, label: string) => (
    <button
      onClick={() => (key === sortKey ? setDesc(!desc) : (setSortKey(key), setDesc(true)))}
      className="flex items-center gap-1 font-medium hover:text-ink"
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <div className="border border-hairline rounded-lg overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-hairline bg-panel text-left text-faint text-[11px] uppercase tracking-wider">
            <th className="px-4 py-2.5 font-medium">Agent</th>
            <th className="px-4 py-2.5">{sortButton("call_count", "Calls")}</th>
            <th className="px-4 py-2.5">{sortButton("avg_qa_score", "Avg QA")}</th>
            <th className="px-4 py-2.5">{sortButton("avg_health_score", "Avg Health")}</th>
            <th className="px-4 py-2.5">{sortButton("violation_count", "Violations")}</th>
            <th className="px-4 py-2.5 font-medium">High Risk Calls</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr key={a.id} className="border-b border-hairline last:border-0 hover:bg-panelRaised/60 transition-colors">
              <td className="px-4 py-3">
                <Link href={`/agents/${a.id}`} className="text-ink hover:text-accent font-medium">
                  {a.name}
                </Link>
                {a.team && <span className="text-muted text-[12px] ml-2">{a.team}</span>}
              </td>
              <td className="px-4 py-3 font-mono tabular text-muted">{a.call_count}</td>
              <td className={`px-4 py-3 font-mono tabular font-medium ${scoreColor(a.avg_qa_score)}`}>
                {a.avg_qa_score != null ? a.avg_qa_score.toFixed(0) : "—"}
              </td>
              <td className={`px-4 py-3 font-mono tabular font-medium ${scoreColor(a.avg_health_score)}`}>
                {a.avg_health_score != null ? a.avg_health_score.toFixed(0) : "—"}
              </td>
              <td className="px-4 py-3 font-mono tabular">
                {a.violation_count > 0 ? <span className="text-bad">{a.violation_count}</span> : <span className="text-faint">0</span>}
              </td>
              <td className="px-4 py-3 font-mono tabular">
                {a.high_risk_call_count > 0 ? <span className="text-bad">{a.high_risk_call_count}</span> : <span className="text-faint">0</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
