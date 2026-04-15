import React from "react";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";

interface PanicModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function PanicModeModal({ isOpen, onClose, onConfirm, isPending }: PanicModeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div className="hl-card w-full max-w-sm animate-in zoom-in-95 duration-150 relative">

        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[var(--foreground)]">
              Initiate Panic Mode?
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-xs text-[var(--foreground-muted)] mb-4 leading-relaxed">
            This will immediately trigger the following defensive sequence:
          </p>

          <div className="space-y-2">
            <div className="hl-panel px-3 py-2.5 border-l-2 border-l-red-500/60 flex items-start gap-2.5">
              <span className="mt-0.5 text-[9px] font-bold uppercase text-red-500">01</span>
              <p className="text-xs text-[var(--foreground)] leading-relaxed">
                Cancel <strong>ALL</strong> open resting orders across all symbols.
              </p>
            </div>
            <div className="hl-panel px-3 py-2.5 border-l-2 border-l-amber-500/60 flex items-start gap-2.5">
              <span className="mt-0.5 text-[9px] font-bold uppercase text-amber-500">02</span>
              <p className="text-xs text-[var(--foreground)] leading-relaxed">
                Market close <strong>50%</strong> of your largest exposure position.
              </p>
            </div>
            <div className="hl-panel px-3 py-2.5 border-l-2 border-l-[var(--accent)]/50 flex items-start gap-2.5">
              <span className="mt-0.5 text-[9px] font-bold uppercase text-[var(--accent)]">03</span>
              <p className="text-xs text-[var(--foreground)] leading-relaxed">
                Apply emergency <strong>−2% Stop-Loss</strong> and <strong>+5% Take-Profit</strong> to all open trades.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-2.5 text-[11px] uppercase tracking-widest font-semibold border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-white/20 transition-colors rounded-sm disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 text-[11px] uppercase tracking-widest font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors rounded-sm disabled:opacity-40"
          >
            {isPending ? "Executing…" : "Confirm Panic"}
          </button>
        </div>

        <div className="px-5 pb-4 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-[var(--foreground-muted)]" />
          <span className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-widest">
            Execute at your own risk
          </span>
        </div>
      </div>
    </div>
  );
}
