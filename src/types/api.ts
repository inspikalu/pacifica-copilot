import type { DashboardData } from "@/types/domain";

export interface ApiEnvelope<T> {
  data: T;
}

export interface ProtectedActionInput {
  passphrase: string;
}

export interface ReducePositionInput extends ProtectedActionInput {
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
}

export interface SetTpslInput extends ProtectedActionInput {
  symbol: string;
  side: "LONG" | "SHORT";
  takeProfit?: number;
  stopLoss?: number;
}

export interface CancelAllInput extends ProtectedActionInput {
  allSymbols: boolean;
  excludeReduceOnly: boolean;
  symbol?: string;
}

export interface ConnectAccountInput {
  label: string;
  pacificaAccount: string;
  agentWallet?: string;
}

export type DashboardResponse = ApiEnvelope<DashboardData>;
