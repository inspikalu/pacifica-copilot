import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  label: ReactNode;
  value: string;
  tone?: "default" | "warning" | "danger" | "success";
  detail?: string;
  icon?: ReactNode;
}

const toneValueMap = {
  default: "text-[var(--foreground)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
  success: "text-[var(--accent)]",
};

export function SummaryCard({ label, value, tone = "default", detail, icon }: SummaryCardProps) {
  return (
    <div className={cn("hl-card p-5 flex flex-col justify-between group transition-colors hover:border-white/10")}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--foreground-muted)] font-medium">
          {label}
        </span>
        {icon && <span className="opacity-40">{icon}</span>}
      </div>
      <div className={cn("text-2xl font-medium hl-num", toneValueMap[tone])}>
        {value}
      </div>
      {detail && (
        <p className="mt-2 text-[11px] text-[var(--foreground-muted)] tracking-wide">
          {detail}
        </p>
      )}
    </div>
  );
}
