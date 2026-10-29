import { LucideIcon, Inbox } from "lucide-react";

export default function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  variant = "default",
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  variant?: "default" | "good" | "warn";
}) {
  const styles = {
    default: "border-dashed border-hairline text-muted",
    good: "border-good/30 bg-good/5 text-good",
    warn: "border-warn/30 bg-warn/5 text-warn",
  }[variant];

  return (
    <div className={`border rounded-lg py-14 text-center text-sm ${styles}`}>
      <Icon className="w-6 h-6 mx-auto mb-2.5 opacity-70" strokeWidth={1.5} />
      <div className="font-medium">{title}</div>
      {description && <div className="mt-1 text-[12.5px] opacity-80 px-6">{description}</div>}
    </div>
  );
}
