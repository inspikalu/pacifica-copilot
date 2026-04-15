import type { AlertRow } from "@/types/domain";

const severityStyles = {
  INFO: { row: "border-l-2 border-l-sky-500/40", badge: "text-sky-400 bg-sky-950/40" },
  WARNING: { row: "border-l-2 border-l-amber-500/40", badge: "text-amber-400 bg-amber-950/40" },
  CRITICAL: { row: "border-l-2 border-l-red-500/60", badge: "text-red-400 bg-red-950/40" },
};

export function AlertList({ alerts }: { alerts: AlertRow[] }) {
  return (
    <div className="hl-card p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--foreground-muted)] font-medium">
          Active Alerts
        </span>
        <span className="hl-badge">{alerts.length} active</span>
      </div>
      <div className="space-y-2 flex-1">
        {alerts.length === 0 && (
          <p className="text-xs text-[var(--foreground-muted)] opacity-50 py-4 text-center">
            No active alerts
          </p>
        )}
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`hl-panel px-3 py-3 ${severityStyles[alert.severity].row}`}
          >
            <div className="flex items-center justify-between gap-3 mb-1">
              <p className="text-xs font-medium text-[var(--foreground)]">{alert.title}</p>
              <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm font-bold ${severityStyles[alert.severity].badge}`}>
                {alert.severity}
              </span>
            </div>
            <p className="text-[11px] text-[var(--foreground-muted)] leading-relaxed">{alert.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
