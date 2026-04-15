import { Bot, Zap } from "lucide-react";

import type { AgentInsight } from "@/types/domain";

interface AgentFeedProps {
  insights: AgentInsight[];
  isPending: boolean;
  onExecuteAction: (insight: AgentInsight) => void;
  isReadOnly?: boolean;
}

const severityConfig = {
  CRITICAL: { label: "text-red-400", bg: "bg-red-950/50 border-l-2 border-l-red-500/60" },
  WARNING:  { label: "text-amber-400", bg: "bg-amber-950/30 border-l-2 border-l-amber-500/50" },
  INFO:     { label: "text-sky-400", bg: "bg-sky-950/20 border-l-2 border-l-sky-500/30" },
};

const actionConfig = {
  REDUCE_POSITION: { label: "Reduce Position", color: "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30" },
  SET_TPSL:        { label: "Set TP / SL",       color: "bg-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent-dim)] border border-[var(--accent-border)]" },
  PANIC_MODE:      { label: "Panic Mode",        color: "bg-red-950/50 text-red-400 hover:bg-red-900/50 border border-red-500/40" },
  CANCEL_ALL:      { label: "Cancel All Orders", color: "bg-white/5 text-white hover:bg-white/10 border border-white/10" },
};

export function AgentFeed({ insights, isPending, onExecuteAction, isReadOnly = false }: AgentFeedProps) {
  return (
    <div className="hl-card p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[var(--accent)]" />
          <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--foreground-muted)] font-medium">
            Risk Intelligence Feed
          </span>
        </div>
        <span className="text-[10px] text-[var(--foreground-muted)] opacity-60">Llama 3.1</span>
      </div>

      {/* Feed Items */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {insights.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Bot className="h-5 w-5 text-[var(--foreground-muted)] opacity-30" />
            <p className="text-[11px] text-[var(--foreground-muted)] opacity-50 uppercase tracking-wider">
              Initializing…
            </p>
          </div>
        )}

        {insights.map((insight) => {
          const sev = severityConfig[insight.severity] ?? severityConfig.INFO;
          const action = insight.actionPayload?.type ? actionConfig[insight.actionPayload.type as keyof typeof actionConfig] : null;

          return (
            <div key={insight.id} className={`hl-panel p-3 ${sev.bg}`}>
              {/* Meta */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`text-[9px] uppercase tracking-widest font-bold ${sev.label}`}>
                  {insight.severity}
                </span>
                <span className="text-[10px] text-[var(--foreground-muted)]">
                  {new Date(insight.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>

              {/* Body */}
              <p className="text-xs text-[var(--foreground)] leading-relaxed opacity-90">
                {insight.text}
              </p>

              {/* Action button */}
              {!isReadOnly && action && insight.actionPayload && (
                <button
                  disabled={isPending}
                  onClick={() => onExecuteAction(insight)}
                  className={`mt-3 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-sm text-[10px] font-semibold uppercase tracking-widest transition-colors ${action.color} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Zap className="h-3 w-3 shrink-0" />
                    <span className="truncate">{action.label}</span>
                  </span>
                  <span className="opacity-40 shrink-0">→</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
