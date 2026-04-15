import Link from "next/link";
import { ArrowRight, ShieldAlert, Siren, Waves } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12">
      <div className="mb-16 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Pacifica Hackathon MVP</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight">Pacifica Risk Copilot</h1>
        </div>
        <Link className={buttonVariants()} href="/dashboard">
          Open Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>

      <section className="grid gap-6 md:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[36px] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_18px_60px_rgba(20,20,20,0.06)]">
          <p className="max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
            A web-based real-time risk dashboard for Pacifica traders. It monitors live account state, surfaces risk
            alerts, and lets users take protective action before a position becomes a liquidation problem.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-[#edf7f6] p-5">
              <ShieldAlert className="h-6 w-6 text-[var(--primary)]" />
              <p className="mt-3 font-medium">Risk Visibility</p>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">Track leverage, concentration, and liquidation room.</p>
            </div>
            <div className="rounded-3xl bg-[#fff1e5] p-5">
              <Siren className="h-6 w-6 text-[var(--warning)]" />
              <p className="mt-3 font-medium">Actionable Alerts</p>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">Turn market stress into fast decisions instead of surprise losses.</p>
            </div>
            <div className="rounded-3xl bg-[#eaf3ff] p-5">
              <Waves className="h-6 w-6 text-sky-700" />
              <p className="mt-3 font-medium">Protective Actions</p>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">Set TP/SL, reduce size, or cancel all open orders in one place.</p>
            </div>
          </div>
        </div>

        <div className="rounded-[36px] border border-[var(--border)] bg-[#1d312d] p-8 text-[#f3f7f5]">
          <p className="text-sm uppercase tracking-[0.24em] text-[#c7d8d3]">Scope Rule</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Ship the dashboard first.</h2>
          <p className="mt-4 text-sm leading-7 text-[#d7e3df]">
            Panic Mode and Telegram alerts are stretch features. The core deliverable is a stable web app with live
            risk state and a few reliable protective actions.
          </p>
        </div>
      </section>
    </main>
  );
}
