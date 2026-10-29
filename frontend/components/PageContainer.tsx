export default function PageContainer({ children }: { children: React.ReactNode }) {
  return <div className="px-8 py-7 max-w-[1200px] mx-auto">{children}</div>;
}
