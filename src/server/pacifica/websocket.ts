import { WebSocket } from "ws";
import { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

export class PacificaWebSocket {
  private ws: WebSocket | null = null;
  private account: string | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(account: string) {
    this.account = account;
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(env.PACIFICA_WS_URL);

    this.ws.on("open", () => {
      console.log(`[WS] Connected to Pacifica for ${this.account}`);
      this.subscribe();
      this.startHeartbeat();
    });

    this.ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(message);
    });

    this.ws.on("close", () => {
      console.log(`[WS] Disconnected for ${this.account}. Reconnecting in 5s...`);
      this.stopHeartbeat();
      setTimeout(() => this.connect(), 5000);
    });

    this.ws.on("error", (err) => {
      console.error(`[WS] Error for ${this.account}:`, err);
    });
  }

  private subscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const channels = ["account_info", "account_positions", "account_trades"];
    channels.forEach((source) => {
      this.ws?.send(
        JSON.stringify({
          method: "subscribe",
          params: { source, account: this.account },
        })
      );
    });
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: "ping" }));
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async handleMessage(message: { channel: string; data: any }) {
    const { channel, data } = message;

    if (channel === "account_info") {
      await this.syncAccountInfo(data);
    } else if (channel === "account_positions") {
      await this.syncPositions(data);
    } else if (channel === "account_trades") {
      await this.syncTrades(data);
    }
  }

  private async syncAccountInfo(data: { ae: string | number; b: string | number; mu: string | number; t: string | number }) {
    // Sync for ALL users tracking this account
    const accounts = await db.trackedAccount.findMany({
      where: { pacificaAccount: this.account! },
    });

    for (const account of accounts) {
      await db.accountSnapshot.create({
        data: {
          trackedAccountId: account.id,
          equity: new Prisma.Decimal(data.ae),
          balance: new Prisma.Decimal(data.b),
          unrealizedPnl: new Prisma.Decimal(Number(data.ae) - Number(data.b)),
          marginUsed: new Prisma.Decimal(data.mu),
          riskScore: 0, 
          snapshotAt: new Date(data.t),
        },
      });

      await db.trackedAccount.update({
        where: { id: account.id },
        data: { lastSyncedAt: new Date() },
      });
    }
  }

  private async syncPositions(data: any[]) {
    const accounts = await db.trackedAccount.findMany({
      where: { pacificaAccount: this.account! },
    });

    for (const account of accounts) {
      if (!data || data.length === 0) {
        await db.positionSnapshot.deleteMany({
          where: { trackedAccountId: account.id },
        });
        continue;
      }

      for (const pos of data) {
        // Defensive mapping for both WS shorthands and REST-style full names
        const symbol = pos.symbol || pos.s;
        const rawSide = pos.side || pos.d;
        const side = rawSide === "bid" ? "LONG" : "SHORT";
        const size = pos.amount || pos.a;
        const entryPrice = pos.entry_price || pos.p;
        const liqPrice = pos.liquidation_price || pos.l;

        if (!symbol) continue;

        await db.positionSnapshot.upsert({
          where: {
            trackedAccountId_symbol_side: {
              trackedAccountId: account.id,
              symbol,
              side,
            },
          },
          update: {
            size: new Prisma.Decimal(size),
            entryPrice: new Prisma.Decimal(entryPrice),
            markPrice: new Prisma.Decimal(entryPrice), 
            unrealizedPnl: new Prisma.Decimal(0), 
            liquidationPrice: liqPrice ? new Prisma.Decimal(liqPrice) : null,
          },
          create: {
            trackedAccountId: account.id,
            symbol,
            side,
            size: new Prisma.Decimal(size),
            entryPrice: new Prisma.Decimal(entryPrice),
            markPrice: new Prisma.Decimal(entryPrice),
            leverage: new Prisma.Decimal(10),
            unrealizedPnl: new Prisma.Decimal(0),
            liquidationPrice: liqPrice ? new Prisma.Decimal(liqPrice) : null,
          },
        });
      }
    }
  }

  private async syncTrades(data: { i: string | number; p: string; a: string; pnl?: string; f?: string; s: string; d: string; t: string | number } | any) {
    const accounts = await db.trackedAccount.findMany({
      where: { pacificaAccount: this.account! },
    });

    const trades = Array.isArray(data) ? data : [data];

    for (const account of accounts) {
      for (const trade of trades) {
        await db.tradeFill.upsert({
          where: { tradeId: trade.i.toString() },
          update: {
            price: new Prisma.Decimal(trade.p),
            size: new Prisma.Decimal(trade.a),
            realizedPnl: trade.pnl ? new Prisma.Decimal(trade.pnl) : null,
            fee: trade.f ? new Prisma.Decimal(trade.f) : null,
          },
          create: {
            trackedAccountId: account.id,
            tradeId: trade.i.toString(),
            symbol: trade.s,
            side: trade.d === "bid" ? "LONG" : "SHORT",
            price: new Prisma.Decimal(trade.p),
            size: new Prisma.Decimal(trade.a),
            realizedPnl: trade.pnl ? new Prisma.Decimal(trade.pnl) : null,
            fee: trade.f ? new Prisma.Decimal(trade.f) : null,
            executedAt: new Date(trade.t),
          },
        });
      }
    }
  }
}

/**
 * Multi-account WebSocket registry for multi-tenant support.
 */
const globalForWS = globalThis as unknown as {
  pacificaWSInstances?: Map<string, PacificaWebSocket>;
};

if (!globalForWS.pacificaWSInstances) {
  globalForWS.pacificaWSInstances = new Map();
}

export const getPacificaWebSocket = (account: string) => {
  if (!globalForWS.pacificaWSInstances!.has(account)) {
    const instance = new PacificaWebSocket(account);
    globalForWS.pacificaWSInstances!.set(account, instance);
  }
  return globalForWS.pacificaWSInstances!.get(account);
};
