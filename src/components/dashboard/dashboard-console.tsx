"use client";

import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, LoaderCircle, Shield, ShieldAlert, Wallet, X, Settings, Radio, ArrowLeft, ExternalLink, RotateCcw, Key, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useTransition, useEffect, FormEvent } from "react";
import { toast } from "sonner";

import { encryptClient } from "@/lib/crypto-client";
import { onboardAccount } from "@/server/actions/onboard";
import { EquityChart } from "@/components/charts/equity-chart";
import { AgentFeed } from "@/components/dashboard/agent-feed";
import { AlertList } from "@/components/dashboard/alert-list";
import { DataTable } from "@/components/dashboard/data-table";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { RiskTooltip } from "@/components/dashboard/risk-tooltip";
import { PanicModeModal } from "@/components/dashboard/panic-mode-modal";
import { Button } from "@/components/ui/button";
import { usePacificaSocket } from "@/hooks/use-pacifica-socket";
import type { CancelAllInput, ConnectAccountInput, ReducePositionInput, SetTpslInput } from "@/types/api";
import type { DashboardData, PositionRow, AgentInsight } from "@/types/domain";

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

const defaultConnectForm = {
  label: "Primary Pacifica Account",
  pacificaAccount: "42trU9A5ActivePacificaAccount",
  agentWallet: "7g9rProfessionalAgentWallet",
};

interface DashboardConsoleProps {
  data: DashboardData;
  isReadOnly?: boolean;
  isReplay?: boolean;
}

export function DashboardConsole({ data, isReadOnly = false, isReplay = false }: DashboardConsoleProps) {
  const router = useRouter();
  const [selectedPosition, setSelectedPosition] = useState<PositionRow | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPanicModalOpen, setIsPanicModalOpen] = useState(false);

  // Live WebSocket state
  const { updates, liveAccount, isConnected, reconnect } = usePacificaSocket(data.account.accountAddress);
  const [connectForm, setConnectForm] = useState<ConnectAccountInput>({
    label: data.account.label,
    pacificaAccount: data.account.accountAddress,
    agentWallet: data.account.agentWallet ?? "",
  });
  const [tpSlForm, setTpSlForm] = useState({
    takeProfit: "",
    stopLoss: "",
  });
  const [reduceSize, setReduceSize] = useState("");
  const [isPending, startTransition] = useTransition();
  const [passphrase, setPassphrase] = useState<string>("");
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; payload?: any } | null>(null);
  
  const [showUnlockPassphrase, setShowUnlockPassphrase] = useState(false);
  const [showUpdateKey, setShowUpdateKey] = useState(false);
  const [showUpdatePassphrase, setShowUpdatePassphrase] = useState(false);

  const [isUpdatingAgent, setIsUpdatingAgent] = useState(false);
  const [updateAgentForm, setUpdateAgentForm] = useState({
    agentWallet: data.account.agentWallet ?? "",
    agentPrivateKey: "",
    passphrase: ""
  });

  useEffect(() => {
    setSelectedPosition((current) => {
      if (!current) return null;

      const next = data.positions.find((position) => position.symbol === current.symbol && position.side === current.side);
      // If the selected position was closed, clear the selection
      return next ?? null;
    });
  }, [data.positions]);

  useEffect(() => {
    if (!selectedPosition) {
      setTpSlForm({ takeProfit: "", stopLoss: "" });
      setReduceSize("");
      return;
    }

    setTpSlForm({
      takeProfit: String(Number((selectedPosition.markPrice * 1.03).toFixed(2))),
      stopLoss: String(Number((selectedPosition.markPrice * 0.97).toFixed(2))),
    });
    setReduceSize(String(Number((selectedPosition.size / 2).toFixed(4))));
  }, [selectedPosition]);

  useEffect(() => {
    setConnectForm({
      label: data.account.label,
      pacificaAccount: data.account.accountAddress,
      agentWallet: data.account.agentWallet ?? "",
    });
  }, [data.account.accountAddress, data.account.agentWallet, data.account.label]);

  useEffect(() => {
    if (isReadOnly || isReplay) return;
    const timer = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 5_000); // High-frequency sync for live testing

    return () => window.clearInterval(timer);
  }, [router, isReadOnly, isReplay]);

  const activeAlertsLabel = useMemo(() => {
    const critical = data.alerts.filter((alert) => alert.severity === "CRITICAL").length;

    if (critical > 0) {
      return `${critical} critical`;
    }

    return `${data.alerts.length} active`;
  }, [data.alerts]);

  // Real-time data merging
  const livePositions = useMemo(() => {
    return data.positions.map(pos => {
      const livePrice = updates[pos.symbol];
      if (!livePrice) return pos;

      const priceDiff = livePrice - pos.entryPrice;
      const sideMult = pos.side === "LONG" ? 1 : -1;
      const liveUpnl = priceDiff * pos.size * sideMult;

      return {
        ...pos,
        markPrice: livePrice,
        unrealizedPnl: liveUpnl
      };
    });
  }, [data.positions, updates]);

  const liveEquity = liveAccount.equity ?? data.account.equity;
  const liveUpnlResult = liveAccount.equity 
    ? (liveAccount.equity - (liveAccount.balance ?? data.account.balance)) 
    : data.account.unrealizedPnl;

  async function submitJson<TPayload>(url: string, payload: TPayload, successMessage: string) {
    const promise = async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await response.json();
      if (!response.ok) {
        const errStr = (json.error ?? "").toLowerCase();
        if (errStr.includes("decrypt") || errStr.includes("auth tag") || errStr.includes("passphrase")) {
          setPassphrase("");
          setIsUnlockModalOpen(true); // Re-prompt instantly
          throw new Error("Invalid Session Passphrase. Try again.");
        }
        throw new Error(json.error ?? "Operation failed on Pacifica side.");
      }
      
      router.refresh();
      return json;
    };

    toast.promise(promise, {
      loading: 'Executing operation...',
      success: successMessage,
      error: (err) => err instanceof Error ? err.message : "Request failed.",
    });
  }

  async function handleConnectAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitJson("/api/account", connectForm, "Tracked account updated.");
  }

  async function handleUpdateAgent(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const encrypted = await encryptClient(updateAgentForm.agentPrivateKey, updateAgentForm.passphrase);
        const res = await onboardAccount({
          label: data.account.label,
          pacificaAccount: data.account.accountAddress, // Updates existing row
          agentWallet: updateAgentForm.agentWallet,
          encryptedAgentKey: encrypted.ciphertext,
          keyIv: encrypted.iv,
          agentKeySalt: encrypted.salt,
          agentKeyAuthTag: encrypted.authTag,
        });
        
        if (res.success) {
          toast.success("Agent credentials updated securely.");
          setIsUpdatingAgent(false);
          setUpdateAgentForm(f => ({ ...f, agentPrivateKey: "", passphrase: "" }));
          router.refresh();
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to update agent credentials");
      }
    });
  }

  // Wrapper for all destructive actions that require an unlocked agent
  function withUnlock(type: string, payload?: any) {
    if (!passphrase) {
      setPendingAction({ type, payload });
      setIsUnlockModalOpen(true);
      return false;
    }
    return true;
  }

  async function handleUnlockConfirm(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const p = fd.get("passphrase") as string;

    if (!p) return;
    
    setPassphrase(p);
    setIsUnlockModalOpen(false);

    if (pendingAction) {
       // Re-trigger the action that was interrupted
       if (pendingAction.type === 'TP_SL') handleSetTpsl();
       if (pendingAction.type === 'REDUCE') handleReducePosition();
       if (pendingAction.type === 'CANCEL') handleCancelAll();
       if (pendingAction.type === 'PANIC') handleTriggerPanic();
       if (pendingAction.type === 'AGENT_ACTION') handleAgentAction(pendingAction.payload);
       setPendingAction(null);
    }
  }

  async function handleSetTpsl(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    if (!selectedPosition) return;
    if (!withUnlock('TP_SL')) return;

    const payload: SetTpslInput & { passphrase?: string } = {
      symbol: selectedPosition.symbol,
      side: selectedPosition.side,
      takeProfit: tpSlForm.takeProfit ? Number(tpSlForm.takeProfit) : undefined,
      stopLoss: tpSlForm.stopLoss ? Number(tpSlForm.stopLoss) : undefined,
      passphrase,
    };

    await submitJson("/api/actions/set-tpsl", payload, `TP/SL orders queued for ${selectedPosition.symbol}.`);
  }

  async function handleReducePosition(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    if (!selectedPosition) return;
    if (!withUnlock('REDUCE')) return;

    const payload: ReducePositionInput & { passphrase?: string } = {
      symbol: selectedPosition.symbol,
      side: selectedPosition.side,
      size: Number(reduceSize),
      passphrase,
    };

    await submitJson("/api/actions/reduce-position", payload, `${selectedPosition.symbol} position reduced.`);
  }

  async function handleCancelAll() {
    if (!withUnlock('CANCEL')) return;

    const payload: CancelAllInput & { passphrase?: string } = {
      allSymbols: true,
      excludeReduceOnly: false,
      passphrase,
    };

    await submitJson("/api/actions/cancel-all", payload, "All open orders cancelled.");
  }

  async function handleAgentAction(insight: AgentInsight) {
    if (!insight.actionPayload) return;
    if (!withUnlock('AGENT_ACTION', insight)) return;

    if (insight.actionPayload.type === 'REDUCE_POSITION') {
      await submitJson("/api/actions/reduce-position", {
        symbol: insight.actionPayload.symbol,
        side: insight.actionPayload.side,
        size: insight.actionPayload.suggestedSize,
        passphrase,
      }, `${insight.actionPayload.symbol} position reduced based on insight.`);
    }

    if (insight.actionPayload.type === 'SET_TPSL') {
      await submitJson("/api/actions/set-tpsl", {
        symbol: insight.actionPayload.symbol,
        side: insight.actionPayload.side,
        takeProfit: insight.actionPayload.suggestedTakeProfit,
        stopLoss: insight.actionPayload.suggestedStopLoss,
        passphrase,
      }, `TP/SL configured based on insight.`);
    }

    if (insight.actionPayload.type === 'CANCEL_ALL') {
       await handleCancelAll();
    }

    if (insight.actionPayload.type === 'PANIC_MODE') {
       setIsPanicModalOpen(true);
    }
  }

  async function handleTriggerPanic() {
    if (!withUnlock('PANIC')) return;
    await submitJson("/api/actions/panic-mode", { passphrase }, "Panic Mode executed. All orders cleared and exposure reduced.");
    setIsPanicModalOpen(false);
  }

  return (
    <main className="mx-auto max-w-screen-xl px-5 py-7 font-sans">
      {/* ── Top bar ────────────────────────────────── */}
      <div className="border-b border-[var(--border)] pb-5 mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--foreground-muted)] font-medium">
              Pacifica Risk Copilot
            </span>
            <span className="hl-badge">v1.0</span>
            {isConnected ? (
              <span className="flex items-center gap-1.5">
                <span className="status-dot-live" />
                <span className="text-[9px] uppercase tracking-widest text-[var(--accent)] font-medium">Live</span>
              </span>
            ) : (
              <button
                onClick={() => reconnect()}
                className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity group"
                title="Click to retry connection"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 group-hover:animate-pulse" />
                <span className="text-[9px] uppercase tracking-widest text-red-500 font-medium">Offline • Retry</span>
              </button>
            )}
          </div>
          <h1 className="text-xl font-semibold text-[var(--foreground)] tracking-tight">
            {isReplay ? "Historical Replay" : isReadOnly ? "Risk Intelligence" : data.account.label}
          </h1>
          <p className="mt-0.5 text-[11px] text-[var(--foreground-muted)] font-mono">
            {data.account.accountAddress}
            {isReplay && <span className="ml-2 text-amber-400">[REPLAY]</span>}
            {isReadOnly && !isReplay && <span className="ml-2 text-[var(--accent)]">[PUBLIC SNAPSHOT]</span>}
          </p>
        </div>

        {/* Action buttons */}
        {isReplay ? (
          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 text-[11px] uppercase tracking-widest font-semibold border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors rounded-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Exit Replay
            </Link>
          </div>
        ) : isReadOnly ? (
          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 text-[11px] uppercase tracking-widest font-semibold border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-white/20 transition-colors rounded-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const reportUrl = `${window.location.origin}/report/${data.account.accountAddress}`;
                navigator.clipboard.writeText(reportUrl);
                toast.success("Link copied", { description: "Share this read-only dashboard link." });
              }}
              className="flex items-center gap-2 px-4 py-2 text-[11px] uppercase tracking-widest font-semibold border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-white/20 transition-colors rounded-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Share Report
            </button>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`flex items-center gap-2 px-4 py-2 text-[11px] uppercase tracking-widest font-semibold border transition-colors rounded-sm ${
                isSettingsOpen
                  ? "border-[var(--accent-border)] text-[var(--accent)] bg-[var(--accent-dim)]"
                  : "border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-white/20"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
            <button
              onClick={async () => {
                const res = await fetch("/api/auth/logout", { method: "POST" });
                if (res.ok) {
                  window.location.href = "/onboard";
                }
              }}
              className="px-4 py-2 text-[11px] uppercase tracking-widest font-semibold border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-white/20 transition-colors rounded-sm"
            >
              Log Out
            </button>
            <button
              onClick={() => setIsPanicModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-[11px] uppercase tracking-widest font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors rounded-sm"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Panic Mode
            </button>
          </div>
        )}
      </div>

      <PanicModeModal
        isOpen={isPanicModalOpen}
        onClose={() => setIsPanicModalOpen(false)}
        onConfirm={handleTriggerPanic}
        isPending={isPending}
      />

      {/* Security Unlock Modal */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="hl-card w-full max-w-sm p-8 border-[var(--accent-border)] shadow-[0_0_50px_rgba(45,212,191,0.1)]">
             <div className="flex flex-col items-center text-center mb-6">
                <div className="h-12 w-12 rounded-full bg-[var(--accent-dim)] flex items-center justify-center mb-4">
                   <Key className="h-6 w-6 text-[var(--accent)]" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Unlock Agent</h2>
                <p className="text-[11px] text-[var(--foreground-muted)] mt-2 uppercase tracking-widest leading-relaxed">
                   Enter your session passphrase to decrypt <br/> your agent credentials in memory.
                </p>
             </div>

             <form onSubmit={handleUnlockConfirm} className="space-y-4">
                <div className="relative">
                   <input 
                      type={showUnlockPassphrase ? "text" : "password"}
                      name="passphrase"
                      autoFocus
                      placeholder="Enter Passphrase"
                      className="w-full hl-panel px-4 py-3 text-center text-sm focus:border-[var(--accent)] outline-none pr-10"
                   />
                   <button 
                     type="button" 
                     onClick={() => setShowUnlockPassphrase(p => !p)} 
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] hover:text-white"
                   >
                     {showUnlockPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                   </button>
                </div>
                <div className="flex gap-3 pt-2">
                   <button 
                      type="button"
                      onClick={() => { setIsUnlockModalOpen(false); setPendingAction(null); }}
                      className="flex-1 py-3 text-[10px] uppercase tracking-[0.2em] font-bold border border-[var(--border)] text-[var(--foreground-muted)] hover:border-white/20 transition-colors"
                   >
                      Cancel
                   </button>
                   <button 
                      type="submit"
                      className="flex-1 py-3 text-[10px] uppercase tracking-[0.2em] font-bold bg-[var(--accent)] text-black hover:bg-[var(--accent-hover)] transition-colors"
                   >
                      Unlock Now
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* ── Summary cards ──────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          label={
            <RiskTooltip 
              title="Account Equity" 
              description="The current total value of your account, including all open profit and losses. This is your 'true' wallet balance if you closed everything now."
            >
              Account Equity
            </RiskTooltip>
          }
          value={currency(liveEquity)}
          detail={`${currency(data.account.balance)} balance`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <SummaryCard
          label={
            <RiskTooltip 
              title="Unrealized PnL" 
              description="Your 'paper' profit or loss. These gains or losses are not locked in until you close your positions."
            >
              Unrealized PnL
            </RiskTooltip>
          }
          value={currency(liveUpnlResult)}
          tone={liveUpnlResult >= 0 ? "success" : "danger"}
          detail="Live exposure PnL"
          icon={<Activity className="h-4 w-4" />}
        />
        <SummaryCard
          label={
            <RiskTooltip 
              title="Risk Score" 
              description="A composite score based on your leverage and concentration. 0-30 is Safe, 31-60 is Caution, 61-80 is Warning, and 81+ is Critical risk."
            >
              Risk Score
            </RiskTooltip>
          }
          value={`${data.account.riskScore}/100`}
          tone={data.account.riskScore >= 75 ? "danger" : data.account.riskScore >= 55 ? "warning" : "success"}
          detail="Leverage · Concentration · Liq Pressure"
          icon={<Shield className="h-4 w-4" />}
        />
        <SummaryCard
          label={
            <RiskTooltip 
              title="Active Alerts" 
              description="Critical system detections. These cover leverage spikes, drawdown acceleration, and upcoming funding burdens."
            >
              Active Alerts
            </RiskTooltip>
          }
          value={activeAlertsLabel}
          tone={data.alerts.some((a) => a.severity === "CRITICAL") ? "danger" : "warning"}
          detail="Requires attention"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      {/* ── Main grid ──────────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <EquityChart data={data.equitySeries} />
          <div className="grid gap-3 md:grid-cols-2">
            <AlertList alerts={data.alerts} />
            {!isReadOnly && isSettingsOpen && (
              <div className="hl-card p-5 flex flex-col">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--foreground-muted)] font-medium">Settings</span>
                  <button 
                    onClick={() => { setPassphrase(""); toast.info("Agent Locked", { description: "Passphrase cleared from memory." }) }}
                    className="text-[9px] uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
                  >
                    Lock Agent
                  </button>
                </div>

                {!isUpdatingAgent ? (
                  <>
                    <div className="space-y-4 flex-1">
                       <div className="hl-panel p-3 border-l-2 border-l-[var(--accent)] flex justify-between items-center group">
                          <div className="overflow-hidden pr-2">
                             <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--foreground-muted)] mb-1">Authenticated Wallet</p>
                             <p className="text-[11px] font-mono text-[var(--foreground)] truncate">{data.account.agentWallet || "Not Connected"}</p>
                          </div>
                          <button onClick={() => setIsUpdatingAgent(true)} className="text-[10px] text-[var(--accent)] uppercase tracking-widest hover:underline whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">Edit</button>
                       </div>
                      <div className="space-y-1.5 opacity-40 pointer-events-none">
                        <p className="text-[9px] uppercase tracking-widest text-[var(--foreground-muted)]">Active Pacifica Acc</p>
                        <p className="text-xs font-mono">{data.account.accountAddress}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                       <button 
                         onClick={() => router.push('/onboard')}
                         className="w-full py-2 text-[11px] uppercase tracking-widest font-semibold border border-[var(--border)] text-[var(--foreground-muted)] hover:border-white/20 hover:text-[var(--foreground)] transition-colors rounded-sm"
                       >
                         Switch Account
                       </button>
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleUpdateAgent} className="space-y-4 animate-in fade-in">
                     <p className="text-[10px] text-[var(--accent)] uppercase tracking-widest font-semibold pb-1 border-b border-[var(--border)]">Update Agent Credentials</p>
                     
                     <label className="block">
                       <span className="text-[9px] text-[var(--foreground-muted)] uppercase tracking-wider">Agent Wallet Address</span>
                       <input
                         required
                         className="mt-1 w-full hl-panel px-3 py-2 text-[11px] font-mono focus:border-[var(--accent)] outline-none"
                         value={updateAgentForm.agentWallet}
                         onChange={(e) => setUpdateAgentForm(f => ({ ...f, agentWallet: e.target.value }))}
                       />
                     </label>

                     <label className="block">
                        <span className="text-[9px] text-red-400 uppercase tracking-wider">New Private Key</span>
                        <div className="relative mt-1">
                          <input
                            type={showUpdateKey ? "text" : "password"}
                            required
                            className="w-full hl-panel px-3 py-2 text-[11px] font-mono focus:border-red-500 outline-none pr-8"
                            value={updateAgentForm.agentPrivateKey}
                            onChange={(e) => setUpdateAgentForm(f => ({ ...f, agentPrivateKey: e.target.value }))}
                          />
                          <button 
                            type="button" 
                            onClick={() => setShowUpdateKey(p => !p)} 
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] hover:text-white"
                          >
                            {showUpdateKey ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </label>

                     <label className="block">
                        <span className="text-[9px] text-[var(--accent)] uppercase tracking-wider">Session Passphrase (for encryption)</span>
                        <div className="relative mt-1">
                          <input
                            type={showUpdatePassphrase ? "text" : "password"}
                            required
                            className="w-full hl-panel px-3 py-2 text-[11px] focus:border-[var(--accent)] outline-none pr-8"
                            value={updateAgentForm.passphrase}
                            onChange={(e) => setUpdateAgentForm(f => ({ ...f, passphrase: e.target.value }))}
                          />
                          <button 
                            type="button" 
                            onClick={() => setShowUpdatePassphrase(p => !p)} 
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] hover:text-white"
                          >
                            {showUpdatePassphrase ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </label>

                     <div className="flex gap-2 pt-2">
                        <button type="button" onClick={() => setIsUpdatingAgent(false)} className="flex-1 py-2 text-[10px] uppercase tracking-widest border border-[var(--border)] text-[var(--foreground-muted)] hover:border-white/20 bg-transparent rounded-sm transition-colors">Cancel</button>
                        <button type="submit" disabled={isPending} className="flex-1 py-2 text-[10px] uppercase tracking-widest bg-[var(--accent)] text-black hover:bg-[var(--accent-hover)] rounded-sm disabled:opacity-50 transition-colors">Save</button>
                     </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
        <div>
          <AgentFeed
            insights={data.insights}
            isPending={isPending}
            onExecuteAction={handleAgentAction}
            isReadOnly={isReadOnly}
          />
        </div>
      </div>

      {/* ── Data tables + Action console ────────── */}
      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <DataTable
            title={
              <RiskTooltip title="Positions" description="Your active, live market exposure resulting from executed orders.">
                Positions
              </RiskTooltip>
            }
            rows={livePositions}
            columns={[
              { key: "symbol", header: "Symbol", render: (row) => <span className="font-medium text-[var(--foreground)]">{row.symbol}</span> },
              { key: "side",   header: "Side",   render: (row) => <span className={row.side === "LONG" ? "text-[var(--accent)]" : "text-red-400"}>{row.side}</span> },
              { key: "size",   header: "Size",   render: (row) => row.size.toString() },
              { key: "lev",    header: "Lev",    render: (row) => `${row.leverage}x` },
              { key: "mark",   header: "Mark",   render: (row) => currency(row.markPrice) },
              { key: "upnl",   header: "uPnL",   render: (row) => <span className={row.unrealizedPnl >= 0 ? "text-[var(--accent)]" : "text-red-400"}>{currency(row.unrealizedPnl)}</span> },
              { key: "liq",    header: (
                <RiskTooltip title="Liquidation Buffer" description="The safety gap between current price and force-closure. <5% is Critical danger.">
                  Liq Buffer
                </RiskTooltip>
              ), render: (row) => (row.liquidationBufferPct ? `${row.liquidationBufferPct}%` : "—") },
              { key: "conc",   header: (
                <RiskTooltip title="Concentration" description="How much of your total account exposure is in this single asset.">
                  Conc
                </RiskTooltip>
              ),  render: (row) => `${row.concentrationPct}%` },
            ]}
            emptyMessage="No open positions."
            getRowKey={(row) => `${row.symbol}-${row.side}`}
            onRowClick={(row) => !isReadOnly && setSelectedPosition(row)}
          />
          <p className="text-[10px] text-[var(--foreground-muted)] opacity-40 px-1">
            Mark price and liquidation data updates via WebSocket.
          </p>

          <div className="grid gap-3 xl:grid-cols-2">
            <DataTable
              title={
                <RiskTooltip title="Open Orders" description="Resting limit or stop orders that have not yet been executed by the market.">
                  Open Orders
                </RiskTooltip>
              }
              rows={data.orders}
              columns={[
                { key: "symbol",    header: "Symbol",    render: (row) => row.symbol },
                { key: "type",      header: "Type",      render: (row) => row.orderType },
                { key: "side",      header: "Side",      render: (row) => <span className={row.side === "LONG" ? "text-[var(--accent)]" : "text-red-400"}>{row.side}</span> },
                { key: "price",     header: "Price",     render: (row) => (row.price ? currency(row.price) : "Market") },
                { key: "size",      header: "Size",      render: (row) => row.size.toString() },
                { key: "rdOnly",    header: "Reduce",    render: (row) => (row.reduceOnly ? "Yes" : "No") },
              ]}
              emptyMessage="No open orders."
            />
            <DataTable
              title="Recent Trades"
              rows={data.trades}
              columns={[
                { key: "symbol", header: "Symbol", render: (row) => row.symbol },
                { key: "side",   header: "Side",   render: (row) => <span className={row.side === "LONG" ? "text-[var(--accent)]" : "text-red-400"}>{row.side}</span> },
                { key: "price",  header: "Price",  render: (row) => currency(row.price) },
                { key: "size",   header: "Size",   render: (row) => row.size.toString() },
                { key: "rpnl",   header: "rPnL",   render: (row) => <span className={(row.realizedPnl ?? 0) >= 0 ? "text-[var(--accent)]" : "text-red-400"}>{currency(row.realizedPnl ?? 0)}</span> },
                { key: "time",   header: "Time",   render: (row) => new Date(row.executedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
              ]}
              emptyMessage="No recent trades."
            />
          </div>
        </div>

        {/* ── Action Console ── */}
        <aside className="hl-card p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
            <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--foreground-muted)] font-medium">Action Console</span>
            {selectedPosition && (
              <button
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                onClick={() => setSelectedPosition(null)}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {selectedPosition ? (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-[var(--foreground-muted)] mb-1">Selected position</p>
                <p className="text-base font-semibold text-[var(--foreground)]">
                  {selectedPosition.symbol}
                  <span className={`ml-2 text-xs font-medium ${
                    selectedPosition.side === "LONG" ? "text-[var(--accent)]" : "text-red-400"
                  }`}>{selectedPosition.side}</span>
                </p>
              </div>

              {/* Position stats */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Leverage", value: `${selectedPosition.leverage.toFixed(1)}x` },
                  { label: "Liq Buffer", value: selectedPosition.liquidationBufferPct ? `${selectedPosition.liquidationBufferPct}%` : "—" },
                  { label: "Funding/hr", value: currency(selectedPosition.estimatedFundingHourlyUsd ?? 0) },
                  { label: "Concentration", value: `${selectedPosition.concentrationPct}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="hl-panel px-3 py-2.5">
                    <p className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-sm font-medium text-[var(--foreground)] hl-num">{value}</p>
                  </div>
                ))}
              </div>

              {!isReadOnly && (
                <>
                  {/* Set TP/SL */}
                  <form className="hl-panel p-4 space-y-3" onSubmit={handleSetTpsl}>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--accent)] font-semibold">Set TP / SL</p>
                    <label className="block">
                      <span className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider">Take Profit</span>
                      <input
                        className="mt-1 w-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] px-3 py-2 text-xs rounded-sm focus:border-[var(--accent)] transition-colors hl-num"
                        onChange={(e) => setTpSlForm((f) => ({ ...f, takeProfit: e.target.value }))}
                        value={tpSlForm.takeProfit}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider">Stop Loss</span>
                      <input
                        className="mt-1 w-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] px-3 py-2 text-xs rounded-sm focus:border-[var(--accent)] transition-colors hl-num"
                        onChange={(e) => setTpSlForm((f) => ({ ...f, stopLoss: e.target.value }))}
                        value={tpSlForm.stopLoss}
                      />
                    </label>
                    <button
                      disabled={isPending}
                      type="submit"
                      className="w-full py-2 text-[11px] uppercase tracking-widest font-semibold bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-border)] hover:bg-[var(--accent)] hover:text-[var(--primary-foreground)] transition-colors rounded-sm disabled:opacity-40"
                    >
                      Execute TP/SL
                    </button>
                  </form>

                  {/* Reduce position */}
                  <form className="hl-panel p-4 space-y-3" onSubmit={handleReducePosition}>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-amber-400 font-semibold">Reduce Size</p>
                    <label className="block">
                      <span className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider">Amount</span>
                      <input
                        className="mt-1 w-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] px-3 py-2 text-xs rounded-sm focus:border-amber-500/50 transition-colors hl-num"
                        max={selectedPosition.size}
                        min="0"
                        onChange={(e) => setReduceSize(e.target.value)}
                        step="0.0001"
                        type="number"
                        value={reduceSize}
                      />
                    </label>
                    <button
                      disabled={isPending}
                      type="submit"
                      className="w-full py-2 text-[11px] uppercase tracking-widest font-semibold border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors rounded-sm disabled:opacity-40"
                    >
                      Shrink Now
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-xs text-[var(--foreground-muted)] opacity-50">
                Select a position from the table to activate the execution console.
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
