"use client";

import { Info } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface RiskTooltipProps {
  children: ReactNode;
  title: string;
  description: string;
  className?: string;
}

/**
 * INSTITUTIONAL RISK TOOLTIP
 * Provides plain-English explanations for complex derivatives terms.
 */
export function RiskTooltip({ children, title, description, className }: RiskTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      className={cn("relative inline-flex items-center gap-1 group cursor-help", className)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <span className="border-b border-dotted border-white/20 hover:border-white/40 transition-colors">
        {children}
      </span>
      <Info className="h-3 w-3 opacity-20 group-hover:opacity-60 transition-opacity" />

      {isOpen && (
        <div className="absolute z-50 bottom-full left-0 mb-3 w-64 p-4 bg-[var(--surface-raised)] border border-[var(--accent-border)] rounded shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <p className="text-[10px] uppercase tracking-widest text-[var(--accent)] font-bold mb-2">
            Intelligence: {title}
          </p>
          <p className="text-[11px] leading-relaxed text-[var(--foreground)] opacity-90">
            {description}
          </p>
          <div className="absolute top-full left-4 -mt-px w-2 h-2 bg-[var(--surface-raised)] border-r border-b border-[var(--accent-border)] rotate-45" />
        </div>
      )}
    </div>
  );
}
