import { Prisma, type PositionSide } from "@prisma/client";

import { db } from "@/lib/db";
import { pacifica } from "@/server/pacifica/client";
import { getPacificaWebSocket } from "@/server/pacifica/websocket";
import { generateAgentInsights } from "@/server/risk/agent";
import { scoreFromPositions } from "@/server/risk/score";
import { escapeHTML, sendTelegramMessage } from "@/server/notifications/telegram";
import type { AlertRow, DashboardData, PositionRow } from "@/types/domain";

function asNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber();
}

function computeFundingHourlyUsd(markPrice: number, size: number, leverage: number) {
  const notional = Math.abs(markPrice * size);
  return Number((notional * 0.0000125 * Math.max(1, leverage / 6)).toFixed(2));
}

function computeLiquidationBufferPct(markPrice: number, liquidationPrice: number | null) {
  if (!liquidationPrice || markPrice === 0) {
    return null;
  }

  return Number((Math.abs(markPrice - liquidationPrice) / markPrice * 100).toFixed(2));
}

async function refreshLiveState(trackedAccountId: string) {
  const account = await db.trackedAccount.findUnique({
    where: { id: trackedAccountId },
  });

  if (!account) return;

  const now = new Date();
  const lastSyncedAt = account.lastSyncedAt ?? new Date(0);

  // Poll every 10 seconds as a fallback to WebSocket
  if (now.getTime() - lastSyncedAt.getTime() < 10_000) {
    return;
  }

  // Initialize/Ensure WebSocket is running in the background (singleton)
  getPacificaWebSocket(account.pacificaAccount);

  try {
    // Fetch fresh snapshots via REST
    const [accountInfo, positionsData, openOrdersData, tradeHistoryData] = await Promise.all([
      pacifica.getAccountInfo(account.pacificaAccount),
      pacifica.getPositions(account.pacificaAccount),
      pacifica.getOpenOrders(account.pacificaAccount),
      pacifica.getTradeHistory(account.pacificaAccount, { limit: 20 }),
    ]);

    const unrealizedPnl = Number(accountInfo.account_equity) - Number(accountInfo.balance);

    const mappedPositions = positionsData.map((pos) => {
      const entryContext = Number(pos.entry_price);
      return {
        symbol: pos.symbol,
        side: pos.side === "bid" ? "LONG" as PositionSide : "SHORT" as PositionSide,
        size: Number(pos.amount),
        entryPrice: entryContext,
        markPrice: entryContext, 
        leverage: pos.leverage ? Number(pos.leverage) : 10,
        unrealizedPnl: 0,
        liquidationPrice: null, 
      };
    });

    const mappedOrders = openOrdersData.map((order: any) => ({
      trackedAccountId,
      orderId: order.order_id ? BigInt(order.order_id) : null,
      symbol: order.symbol,
      side: order.side === "bid" ? "LONG" as PositionSide : "SHORT" as PositionSide,
      price: order.price ? new Prisma.Decimal(order.price) : null,
      size: new Prisma.Decimal(order.amount || 0),
      orderType: order.type || "LIMIT",
      reduceOnly: order.reduce_only === true,
      status: order.status || "OPEN",
    }));

    const temporaryPositionRows = buildPositionRows(mappedPositions);
    const score = scoreFromPositions(temporaryPositionRows);

    await db.$transaction([
      db.accountSnapshot.create({
        data: {
          trackedAccountId,
          equity: new Prisma.Decimal(accountInfo.account_equity),
          balance: new Prisma.Decimal(accountInfo.balance),
          unrealizedPnl: new Prisma.Decimal(unrealizedPnl),
          marginUsed: new Prisma.Decimal(accountInfo.total_margin_used),
          riskScore: score,
          snapshotPositions: temporaryPositionRows as any,
          snapshotAt: now,
        },
      }),
      db.trackedAccount.update({
        where: { id: trackedAccountId },
        data: { lastSyncedAt: now },
      }),
      db.positionSnapshot.deleteMany({ where: { trackedAccountId } }),
      db.positionSnapshot.createMany({
        data: mappedPositions.map((p) => ({
          trackedAccountId,
          symbol: p.symbol,
          side: p.side,
          size: new Prisma.Decimal(p.size),
          entryPrice: new Prisma.Decimal(p.entryPrice),
          markPrice: new Prisma.Decimal(p.markPrice),
          leverage: new Prisma.Decimal(p.leverage), 
          unrealizedPnl: new Prisma.Decimal(0),
          liquidationPrice: null, 
        })),
      }),
      db.openOrder.deleteMany({ where: { trackedAccountId } }),
      db.openOrder.createMany({ data: mappedOrders }),
    ]);

    for (const [index, trade] of tradeHistoryData.entries()) {
      const stableTradeId = (trade.trade_id || trade.id || `historical-${index}-${trade.timestamp}`).toString();
      await db.tradeFill.upsert({
        where: { tradeId: stableTradeId },
        update: {
          price: new Prisma.Decimal(trade.price),
          size: new Prisma.Decimal(trade.amount),
          realizedPnl: trade.pnl ? new Prisma.Decimal(trade.pnl) : null,
          fee: trade.fee ? new Prisma.Decimal(trade.fee) : null,
        },
        create: {
          trackedAccountId,
          tradeId: stableTradeId,
          symbol: trade.symbol,
          side: trade.side === "bid" ? "LONG" : "SHORT",
          price: new Prisma.Decimal(trade.price),
          size: new Prisma.Decimal(trade.amount),
          realizedPnl: trade.pnl ? new Prisma.Decimal(trade.pnl) : null,
          fee: trade.fee ? new Prisma.Decimal(trade.fee) : null,
          executedAt: new Date(trade.timestamp),
        },
      });
    }
  } catch (error) {
    console.error("[Refresh] Failed to fetch live state:", error);
  }
}

function buildPositionRows(
  positions: Array<{
    symbol: string;
    side: PositionSide;
    size: Prisma.Decimal | number;
    entryPrice: Prisma.Decimal | number;
    markPrice: Prisma.Decimal | number;
    leverage: Prisma.Decimal | number;
    unrealizedPnl: Prisma.Decimal | number;
    liquidationPrice: Prisma.Decimal | number | null;
  }>,
): PositionRow[] {
  const totalNotional = positions.reduce((sum, position) => sum + Math.abs(asNumber(position.markPrice) * asNumber(position.size)), 0);

  return positions.map((position) => {
    const markPrice = asNumber(position.markPrice);
    const size = asNumber(position.size);
    const leverage = asNumber(position.leverage);
    const liquidationPrice = position.liquidationPrice ? asNumber(position.liquidationPrice) : null;

    return {
      symbol: position.symbol,
      side: position.side,
      size,
      entryPrice: asNumber(position.entryPrice),
      markPrice,
      leverage,
      unrealizedPnl: asNumber(position.unrealizedPnl),
      liquidationPrice,
      concentrationPct: totalNotional === 0 ? 0 : Number((Math.abs(markPrice * size) / totalNotional * 100).toFixed(1)),
      liquidationBufferPct: computeLiquidationBufferPct(markPrice, liquidationPrice),
      estimatedFundingHourlyUsd: computeFundingHourlyUsd(markPrice, size, leverage),
    };
  });
}

function buildAlerts(input: { positions: PositionRow[]; equitySeries: Array<{ equity: number }>; riskScore: number }) {
  const alerts: Omit<AlertRow, "id" | "triggeredAt" | "status">[] = [];
  const maxDrawdownBase = Math.max(...input.equitySeries.map((point) => point.equity), 0);
  const currentEquity = input.equitySeries[input.equitySeries.length - 1]?.equity ?? 0;
  const drawdownPct = maxDrawdownBase === 0 ? 0 : Number((((maxDrawdownBase - currentEquity) / maxDrawdownBase) * 100).toFixed(1));

  input.positions.forEach((position) => {
    if (position.leverage >= 10) {
      alerts.push({
        title: `${position.symbol} leverage elevated`,
        message: `${position.symbol} is running at ${position.leverage.toFixed(1)}x leverage.`,
        symbol: position.symbol,
        severity: position.leverage >= 14 ? "CRITICAL" : "WARNING",
      });
    }

    if (position.concentrationPct >= 35) {
      alerts.push({
        title: `${position.symbol} concentration is high`,
        message: `${position.symbol} exposure is ${position.concentrationPct}% of open notional.`,
        symbol: position.symbol,
        severity: position.concentrationPct >= 45 ? "CRITICAL" : "WARNING",
      });
    }

    if ((position.liquidationBufferPct ?? 100) <= 10) {
      alerts.push({
        title: `${position.symbol} liquidation buffer is tightening`,
        message: `${position.symbol} has only ${position.liquidationBufferPct}% room to liquidation.`,
        symbol: position.symbol,
        severity: (position.liquidationBufferPct ?? 100) <= 7 ? "CRITICAL" : "WARNING",
      });
    }

    const fundingHourly = position.estimatedFundingHourlyUsd ?? 0;

    if (fundingHourly >= 18) {
      alerts.push({
        title: `${position.symbol} funding burden is elevated`,
        message: `Estimated hourly funding drag is $${fundingHourly.toFixed(2)}.`,
        symbol: position.symbol,
        severity: fundingHourly >= 28 ? "CRITICAL" : "INFO",
      });
    }
  });

  if (drawdownPct >= 5) {
    alerts.push({
      title: "Recent drawdown is accelerating",
      message: `Account equity is ${drawdownPct}% below its recent local high.`,
      symbol: null,
      severity: drawdownPct >= 8 ? "CRITICAL" : "WARNING",
    });
  }

  if (input.riskScore >= 70) {
    alerts.push({
      title: "Composite risk score is elevated",
      message: `Overall account risk is currently ${input.riskScore}/100.`,
      symbol: null,
      severity: input.riskScore >= 82 ? "CRITICAL" : "WARNING",
    });
  }

  return alerts.slice(0, 6);
}

async function persistAlerts(trackedAccountId: string, alerts: ReturnType<typeof buildAlerts>) {
  const existingAlerts = await db.riskAlert.findMany({
    where: { trackedAccountId, status: "ACTIVE" },
    select: { title: true, severity: true },
  });

  await db.riskAlert.deleteMany({
    where: { trackedAccountId, status: "ACTIVE" },
  });

  if (alerts.length === 0) {
    return [];
  }

  const newAlerts = alerts.map((alert, index) => ({
    trackedAccountId,
    type: alert.title.includes("drawdown")
      ? ("DRAWDOWN" as const)
      : alert.title.includes("funding")
        ? ("HIGH_FUNDING_EXPOSURE" as const)
        : alert.title.includes("liquidation")
          ? ("LIQUIDATION_PROXIMITY" as const)
          : alert.title.includes("concentration")
            ? ("HIGH_CONCENTRATION" as const)
            : ("HIGH_LEVERAGE" as const),
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    symbol: alert.symbol ?? null,
    triggeredAt: new Date(Date.now() - index * 60_000),
  }));

  await db.riskAlert.createMany({
    data: newAlerts,
  });

  const criticalNewcomers = alerts.filter(
    (a) =>
      (a.severity === "CRITICAL" || a.severity === "WARNING") &&
      !existingAlerts.some((ea) => ea.title === a.title)
  );

  if (criticalNewcomers.length > 0) {
    const alertList = criticalNewcomers
      .map((a) => `\u26A0\uFE0F <b>${escapeHTML(a.title)}</b>\n${escapeHTML(a.message)}`)
      .join("\n\n");
    
    const message = `\uD83D\uDEA8 <b>Pacifica Risk Alert</b>\n\n${alertList}`;
    sendTelegramMessage(message).catch(console.error);
  }

  return db.riskAlert.findMany({
    where: { trackedAccountId, status: "ACTIVE" },
    orderBy: { triggeredAt: "desc" },
    take: 6,
  });
}

/**
 * NEW: Fetches dashboard data scoped to a specific user.
 */
export async function getDashboardData(userId: string): Promise<DashboardData | null> {
  // Find the user's active account
  const activeAccount = await db.trackedAccount.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!activeAccount) {
    return null; // Signals the UI to redirect to /onboard
  }

  await refreshLiveState(activeAccount.id);

  const account = await db.trackedAccount.findUnique({
    where: { id: activeAccount.id },
    include: {
      positions: true,
      orders: {
        where: { status: "OPEN" },
        orderBy: { updatedAt: "desc" },
      },
      trades: {
        orderBy: { executedAt: "desc" },
        take: 8,
      },
      snapshots: {
        orderBy: { snapshotAt: "desc" },
        take: 12,
      },
    },
  });

  if (!account) return null;

  const positions = buildPositionRows(account.positions);
  const latestSnapshot = account.snapshots[0];
  const riskScore = latestSnapshot?.riskScore ?? scoreFromPositions(positions);
  const equitySeries = [...account.snapshots]
    .reverse()
    .map((snapshot) => ({
      time: snapshot.snapshotAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      equity: asNumber(snapshot.equity),
      riskScore: snapshot.riskScore,
    }));

  const alerts = await persistAlerts(activeAccount.id, buildAlerts({ positions, equitySeries, riskScore }));

  return {
    account: {
      label: account.label,
      accountAddress: account.pacificaAccount,
      equity: latestSnapshot ? asNumber(latestSnapshot.equity) : 0,
      balance: latestSnapshot ? asNumber(latestSnapshot.balance) : 0,
      unrealizedPnl: latestSnapshot ? asNumber(latestSnapshot.unrealizedPnl) : 0,
      riskScore,
      lastSyncedAt: (account.lastSyncedAt ?? new Date()).toISOString(),
      agentWallet: account.agentWallet,
    },
    positions,
    orders: account.orders.map((order) => ({
      symbol: order.symbol,
      side: order.side as "LONG" | "SHORT",
      price: order.price ? asNumber(order.price) : null,
      size: asNumber(order.size),
      status: order.status,
      reduceOnly: order.reduceOnly,
      orderType: order.orderType,
    })),
    trades: account.trades.map((trade) => ({
      symbol: trade.symbol,
      side: trade.side as "LONG" | "SHORT",
      price: asNumber(trade.price),
      size: asNumber(trade.size),
      realizedPnl: trade.realizedPnl ? asNumber(trade.realizedPnl) : null,
      executedAt: trade.executedAt.toISOString(),
    })),
    alerts: alerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      message: alert.message,
      symbol: alert.symbol,
      severity: alert.severity,
      status: alert.status,
      triggeredAt: alert.triggeredAt.toISOString(),
    })),
    equitySeries,
    insights: await generateAgentInsights(positions, alerts, riskScore),
  };
}

export async function getReportData(accountAddress: string): Promise<DashboardData | null> {
  // Public reports can stay the same, but we should find purely by pacificaAccount without scoping to userId
  // to allow sharing research reports.
  const account = await db.trackedAccount.findFirst({
    where: { pacificaAccount: accountAddress },
  });

  if (!account) return null;

  await refreshLiveState(account.id);
  
  const enrichedAccount = await db.trackedAccount.findUnique({
    where: { id: account.id },
    include: {
      positions: true,
      orders: {
        where: { status: "OPEN" },
        orderBy: { updatedAt: "desc" },
      },
      trades: {
        orderBy: { executedAt: "desc" },
        take: 8,
      },
      snapshots: {
        orderBy: { snapshotAt: "desc" },
        take: 12,
      },
    },
  });
  
  if (!enrichedAccount) return null;

  const positions = buildPositionRows(enrichedAccount.positions);
  const latestSnapshot = enrichedAccount.snapshots[0];
  const riskScore = latestSnapshot?.riskScore ?? scoreFromPositions(positions);
  const equitySeries = [...enrichedAccount.snapshots]
    .reverse()
    .map((snapshot) => ({
      time: snapshot.snapshotAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      equity: asNumber(snapshot.equity),
      riskScore: snapshot.riskScore,
      snapshotId: snapshot.id,
    }));

  const alerts = await persistAlerts(enrichedAccount.id, buildAlerts({ positions, equitySeries, riskScore }));

  return {
    account: {
      label: enrichedAccount.label,
      accountAddress: enrichedAccount.pacificaAccount,
      equity: latestSnapshot ? asNumber(latestSnapshot.equity) : 0,
      balance: latestSnapshot ? asNumber(latestSnapshot.balance) : 0,
      unrealizedPnl: latestSnapshot ? asNumber(latestSnapshot.unrealizedPnl) : 0,
      riskScore,
      lastSyncedAt: (enrichedAccount.lastSyncedAt ?? new Date()).toISOString(),
      agentWallet: enrichedAccount.agentWallet,
    },
    positions,
    orders: enrichedAccount.orders.map((order) => ({
      symbol: order.symbol,
      side: order.side as "LONG" | "SHORT",
      price: order.price ? asNumber(order.price) : null,
      size: asNumber(order.size),
      status: order.status,
      reduceOnly: order.reduceOnly,
      orderType: order.orderType,
    })),
    trades: enrichedAccount.trades.map((trade) => ({
      symbol: trade.symbol,
      side: trade.side as "LONG" | "SHORT",
      price: asNumber(trade.price),
      size: asNumber(trade.size),
      realizedPnl: trade.realizedPnl ? asNumber(trade.realizedPnl) : null,
      executedAt: trade.executedAt.toISOString(),
    })),
    alerts: alerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      message: alert.message,
      symbol: alert.symbol,
      severity: alert.severity,
      status: alert.status,
      triggeredAt: alert.triggeredAt.toISOString(),
    })),
    equitySeries,
    insights: await generateAgentInsights(positions, alerts, riskScore),
  };
}

export async function getSnapshotData(snapshotId: string): Promise<DashboardData | null> {
  const snapshot = await db.accountSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      trackedAccount: {
        include: {
          trades: { take: 10, orderBy: { executedAt: "desc" } }
        }
      }
    }
  });

  if (!snapshot) return null;

  const positions = (snapshot.snapshotPositions as any) as PositionRow[] || [];
  
  return {
    account: {
      label: `${snapshot.trackedAccount.label} (Historical)`,
      accountAddress: snapshot.trackedAccount.pacificaAccount,
      equity: asNumber(snapshot.equity),
      balance: asNumber(snapshot.balance),
      unrealizedPnl: asNumber(snapshot.unrealizedPnl),
      riskScore: snapshot.riskScore,
      lastSyncedAt: snapshot.snapshotAt.toISOString(),
      agentWallet: snapshot.trackedAccount.agentWallet,
    },
    positions,
    orders: [], 
    trades: snapshot.trackedAccount.trades.map((trade) => ({
      symbol: trade.symbol,
      side: trade.side as "LONG" | "SHORT",
      price: asNumber(trade.price),
      size: asNumber(trade.size),
      realizedPnl: trade.realizedPnl ? asNumber(trade.realizedPnl) : null,
      executedAt: trade.executedAt.toISOString(),
    })),
    alerts: [], 
    equitySeries: [], 
    insights: await generateAgentInsights(positions, [], snapshot.riskScore),
  };
}
