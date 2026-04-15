import { db } from "@/lib/db";
import { pacifica } from "@/server/pacifica/client";
import type { PositionSide } from "@prisma/client";

export async function setTpsl(input: {
  symbol: string;
  side: PositionSide;
  takeProfit?: number;
  stopLoss?: number;
  privateKeyBase58: string;
  trackedAccountId: string; // Scoped ID
}) {
  const account = await db.trackedAccount.findUnique({
    where: { id: input.trackedAccountId },
  });

  if (!account) throw new Error("No active account for TP/SL action.");

  try {
    const result = await pacifica.setTriggerOrders({
      account: account.pacificaAccount,
      symbol: input.symbol,
      side: input.side === "LONG" ? "ask" : "bid",
      stop_loss_price: input.stopLoss,
      take_profit_price: input.takeProfit,
      privateKeyBase58: input.privateKeyBase58,
    });

    await db.actionLog.create({
      data: {
        trackedAccountId: account.id,
        actionType: "SET_TPSL",
        symbol: input.symbol,
        status: "SUCCESS",
        requestPayload: { tp: input.takeProfit, sl: input.stopLoss } as any,
        responsePayload: result as any,
      },
    });

    return result;
  } catch (error: any) {
    console.error("[SetTPSL] API Error:", error);
    await db.actionLog.create({
      data: {
        trackedAccountId: account.id,
        actionType: "SET_TPSL",
        symbol: input.symbol,
        status: "FAILED",
        errorMessage: error.message || "Failed to set TP/SL",
      },
    });
    throw error;
  }
}
