import { api, CallListResponse } from "@/lib/api";
import CallsTable from "@/components/CallsTable";
import CallsFilterBar from "@/components/CallsFilterBar";
import PageContainer from "@/components/PageContainer";
import AutoRefresh from "@/components/AutoRefresh";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const IN_PROGRESS = ["uploaded", "validating", "processing"];

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; risk_level?: string }>;
}) {
  const { page: pageParam, status, risk_level: riskLevel } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  let data: CallListResponse = { items: [], total: 0, page, page_size: PAGE_SIZE };
  try {
    data = await api.listCalls({ page, pageSize: PAGE_SIZE, status, riskLevel });
  } catch {
    // keep the empty default
  }

  return (
    <PageContainer>
      <header className="mb-7">
        <h1 className="font-display text-[20px] font-semibold tracking-tight">Calls</h1>
        <p className="text-muted text-[13px] mt-1">All recordings, most recent first.</p>
      </header>

      <AutoRefresh active={data.items.some((c) => IN_PROGRESS.includes(c.status))} />
      <CallsFilterBar />
      <CallsTable calls={data.items} />
      <Pagination
        page={data.page}
        pageSize={data.page_size}
        total={data.total}
        basePath="/calls"
        extraParams={{ status, risk_level: riskLevel }}
      />
    </PageContainer>
  );
}
