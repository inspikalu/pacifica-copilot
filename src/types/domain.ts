export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export type AlertStatus = "ACTIVE" | "RESOLVED" | "DISMISSED";

export interface AccountSummary {
  label: string;
  accountAddress: string;
  equity: number;
  balance: number;
  unrealizedPnl: number;
  riskScore: number;
  lastSyncedAt: string;
  agentWallet?: string | null;
}

export interface PositionRow {
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  unrealizedPnl: number;
  liquidationPrice?: number | null;
  concentrationPct: number;
  liquidationBufferPct?: number | null;
  estimatedFundingHourlyUsd?: number | null;
}

export interface OrderRow {
  symbol: string;
  side: "LONG" | "SHORT";
  price?: number | null;
  size: number;
  status: string;
  reduceOnly: boolean;
  orderType: string;
}

export interface TradeRow {
  symbol: string;
  side: "LONG" | "SHORT";
  price: number;
  size: number;
  realizedPnl?: number | null;
  executedAt: string;
}

export interface AlertRow {
  id: string;
  title: string;
  message: string;
  symbol?: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  triggeredAt: string;
}

export interface EquityPoint {
  time: string;
  equity: number;
  riskScore: number;
  snapshotId?: string;
}

export interface AgentInsight {
  id: string;
  timestamp: string;
  text: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  actionPayload?: {
    type: "REDUCE_POSITION" | "SET_TPSL" | "CANCEL_ALL" | "PANIC_MODE";
    symbol?: string;
    side?: "LONG" | "SHORT";
    suggestedSize?: number;
    suggestedTakeProfit?: number;
    suggestedStopLoss?: number;
  };
}

export interface DashboardData {
  account: AccountSummary;
  positions: PositionRow[];
  orders: OrderRow[];
  trades: TradeRow[];
  alerts: AlertRow[];
  equitySeries: EquityPoint[];
  insights: AgentInsight[];
}
