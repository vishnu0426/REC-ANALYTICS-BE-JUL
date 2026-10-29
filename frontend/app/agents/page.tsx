import { api } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import AgentsLeaderboardTable from "@/components/AgentsLeaderboardTable";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  let agents: Awaited<ReturnType<typeof api.listAgents>> = [];
  try {
    agents = await api.listAgents();
  } catch {
    agents = [];
  }

  return (
    <PageContainer>
      <header className="mb-7">
        <h1 className="font-display text-[20px] font-semibold tracking-tight">Agents</h1>
        <p className="text-muted text-[13px] mt-1">
          Per-agent QA trends, call volume, and compliance history.
        </p>
      </header>

      <AgentsLeaderboardTable agents={agents} />
    </PageContainer>
  );
}
