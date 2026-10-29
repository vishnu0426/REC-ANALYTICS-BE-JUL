import CallDetailClient from "@/components/CallDetailClient";

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CallDetailClient callId={id} />;
}
