import { db } from "@/lib/db";
import { pacifica } from "@/server/pacifica/client";
import type { PositionSide } from "@prisma/client";

export async function reducePosition(input: {
  symbol: string;
  side: PositionSide;
  size: number;
  price?: number;
  privateKeyBase58: string;
  trackedAccountId: string; // Scoped ID
}) {
  const account = await db.trackedAccount.findUnique({
    where: { id: input.trackedAccountId },
  });

  if (!account) throw new Error("No active account for reduce action.");

  // Lot size precision floor for Pacifica (4 decimals)
  const amount = Math.floor(input.size * 10000) / 10000;

  try {
    const result = await pacifica.placeOrder({
      account: account.pacificaAccount,
      symbol: input.symbol,
      side: input.side === "LONG" ? "ask" : "bid",
      amount,
      price: input.price,
      order_type: "market",
      tif: "ioc",
      reduce_only: true,
      privateKeyBase58: input.privateKeyBase58,
    });

    await db.actionLog.create({
      data: {
        trackedAccountId: account.id,
        actionType: "REDUCE_POSITION",
        symbol: input.symbol,
        status: "SUCCESS",
        requestPayload: { targetSize: input.size, flooredSize: amount } as any,
        responsePayload: result as any,
      },
    });

    return result;
  } catch (error: any) {
    console.error("[ReducePosition] API Error:", error);
    await db.actionLog.create({
      data: {
        trackedAccountId: account.id,
        actionType: "REDUCE_POSITION",
        symbol: input.symbol,
        status: "FAILED",
        errorMessage: error.message || "Failed to reduce position",
      },
    });
    throw error;
  }
}
