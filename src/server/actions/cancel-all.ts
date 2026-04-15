import { db } from "@/lib/db";
import { pacifica } from "@/server/pacifica/client";

export async function cancelAllOrders(input: { 
  allSymbols?: boolean; 
  symbol?: string; 
  excludeReduceOnly?: boolean;
  privateKeyBase58: string;
  trackedAccountId: string; // Scoped ID
}) {
  const account = await db.trackedAccount.findUnique({
    where: { id: input.trackedAccountId },
  });

  if (!account) throw new Error("No active account for cancel action.");

  try {
    const result = await pacifica.cancelOrders({
      account: account.pacificaAccount,
      symbol: input.allSymbols ? "all" : (input.symbol || "all"),
      privateKeyBase58: input.privateKeyBase58,
    });

    await db.actionLog.create({
      data: {
        trackedAccountId: account.id,
        actionType: "CANCEL_ALL",
        symbol: input.symbol || "ALL",
        status: "SUCCESS",
        responsePayload: result as any,
      },
    });

    return result;
  } catch (error: any) {
    console.error("[CancelAll] API Error:", error);
    await db.actionLog.create({
      data: {
        trackedAccountId: account.id,
        actionType: "CANCEL_ALL",
        symbol: input.symbol || "ALL",
        status: "FAILED",
        errorMessage: error.message || "Failed to cancel orders",
      },
    });
    throw error;
  }
}
