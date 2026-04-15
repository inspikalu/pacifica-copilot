"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Shield, Key, Wallet, ArrowRight, LoaderCircle, CheckCircle2 } from "lucide-react";
import bs58 from "bs58";

import { encryptClient } from "@/lib/crypto-client";
import { onboardAccount } from "@/server/actions/onboard";

export default function OnboardPage() {
  const { publicKey, wallet, signMessage, connected } = useWallet();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [isPending, setIsPending] = useState(false);

  // Form states
  const [accountData, setAccountData] = useState({
    label: "My Pacifica Account",
    pacificaAccount: "",
    agentWallet: "",
    agentPrivateKey: "",
    passphrase: "",
  });

  // Step 1: Auth / SIWS
  const handleSIWS = async () => {
    if (!publicKey || !wallet) {
      toast.error("Connect wallet first");
      return;
    }

    setIsPending(true);
    try {
      // 1. Get challenge
      const res = await fetch("/api/auth/challenge");
      const input = await res.json();

      // 2. Sign challenge (standard SIWS or signMessage fallback)
      // For this hackathon, we'll use a standard message signing flow for broadest compatibility
      const message = new TextEncoder().encode(
        `${input.statement}\n\nDomain: ${input.domain}\nNonce: ${input.nonce}\nAddress: ${publicKey.toBase58()}`
      );
      
      if (!signMessage) throw new Error("Wallet does not support message signing");
      const signature = await signMessage(message);

      // 3. Verify
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          input,
          output: {
            account: { address: publicKey.toBase58() },
            signature: bs58.encode(signature),
          },
        }),
      });

      if (!verifyRes.ok) throw new Error("Authentication failed");

      toast.success("Identity verified");
      setAccountData(prev => ({ ...prev, pacificaAccount: publicKey.toBase58() }));
      setStep(2);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Authentication failed");
    } finally {
      setIsPending(false);
    }
  };

  // Step 4: Final Submit
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountData.agentPrivateKey || !accountData.passphrase) {
      toast.error("Passphrase and Agent Key are required");
      return;
    }

    setIsPending(true);
    try {
      // 1. Client-side encryption
      const encrypted = await encryptClient(accountData.agentPrivateKey, accountData.passphrase);

      // 2. Server-side onboard
      const res = await onboardAccount({
        label: accountData.label,
        pacificaAccount: accountData.pacificaAccount,
        agentWallet: accountData.agentWallet,
        encryptedAgentKey: encrypted.ciphertext,
        keyIv: encrypted.iv,
        agentKeySalt: encrypted.salt,
        agentKeyAuthTag: encrypted.authTag,
      });

      if (res.success) {
        toast.success("Account connected successfully");
        router.push("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save account");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050809] flex items-center justify-center p-6 font-sans">
      <div className="hl-card w-full max-w-lg p-10 relative overflow-hidden">
        {/* Progress header */}
        <div className="flex gap-1 mb-8">
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={`h-1 flex-1 transition-colors duration-500 ${
                step >= s ? "bg-[var(--accent)]" : "bg-white/5"
              }`} 
            />
          ))}
        </div>

        {/* Step 1: Connect & SIWS */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Initialize Copilot</h1>
            <p className="text-[var(--foreground-muted)] mb-8">Sign in with your Solana wallet to establish your secure identity.</p>
            
            <div className="space-y-6">
              <div className="hl-panel p-6 flex flex-col items-center gap-6">
                <Wallet className="h-10 w-10 text-[var(--accent)]" />
                <WalletMultiButton className="hl-btn-primary !w-auto" />
              </div>

              {connected && (
                <button
                  onClick={handleSIWS}
                  disabled={isPending}
                  className="w-full hl-btn-primary py-4 text-xs tracking-[0.2em] font-bold"
                >
                  {isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    "ESTABLISH IDENTITY"
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Linked Account */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Track Pacifica</h1>
            <p className="text-[var(--foreground-muted)] mb-8">Enter the account you want the copilot to monitor.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); setStep(3); }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] font-bold">Account Label</label>
                <input
                  required
                  className="w-full hl-panel px-4 py-3 text-sm focus:border-[var(--accent)] outline-none"
                  value={accountData.label}
                  onChange={(e) => setAccountData({ ...accountData, label: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] font-bold">Pacifica Account Address</label>
                <input
                  required
                  placeholder="The main wallet with positions"
                  className="w-full hl-panel px-4 py-3 text-sm font-mono focus:border-[var(--accent)] outline-none"
                  value={accountData.pacificaAccount}
                  onChange={(e) => setAccountData({ ...accountData, pacificaAccount: e.target.value })}
                />
              </div>
              
              <button
                type="submit"
                className="w-full hl-btn-primary py-4 text-xs tracking-[0.2em] font-bold mt-4 flex items-center justify-center gap-2"
              >
                CONTINUE <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* Step 3: Agent Key & Passphrase */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Authorize Agent</h1>
            <p className="text-[var(--foreground-muted)] mb-8">Set up your delegated sub-wallet for guard actions.</p>
            
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-[var(--foreground-muted)] font-bold">Agent Wallet Address</label>
                <input
                  required
                  className="w-full hl-panel px-4 py-3 text-sm font-mono focus:border-[var(--accent)] outline-none"
                  value={accountData.agentWallet}
                  onChange={(e) => setAccountData({ ...accountData, agentWallet: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-red-400 font-bold">Agent Private Key</label>
                <input
                  type="password"
                  required
                  placeholder="Encrypted client-side before submission"
                  className="w-full hl-panel px-4 py-3 text-sm font-mono border-red-900/40 focus:border-red-500 outline-none"
                  value={accountData.agentPrivateKey}
                  onChange={(e) => setAccountData({ ...accountData, agentPrivateKey: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-[var(--accent)] font-bold">Session Passphrase</label>
                <input
                  type="password"
                  required
                  placeholder="Master key to unlock your Agent"
                  className="w-full hl-panel px-4 py-3 text-sm focus:border-[var(--accent)] outline-none"
                  value={accountData.passphrase}
                  onChange={(e) => setAccountData({ ...accountData, passphrase: e.target.value })}
                />
                <p className="text-[9px] text-[var(--foreground-muted)] opacity-60 mt-1 uppercase tracking-widest leading-relaxed">
                  Lost passphrases cannot be recovered. Your private key is encrypted with this.
                </p>
              </div>
              
              <button
                type="submit"
                disabled={isPending}
                className="w-full hl-btn-primary py-4 text-xs tracking-[0.2em] font-bold mt-4 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <>COMPLETE INITIALIZATION <CheckCircle2 className="h-4 w-4" /></>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
