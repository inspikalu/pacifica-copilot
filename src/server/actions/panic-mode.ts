"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { decrypt } from "@/lib/crypto";
import { cancelAllOrders } from "./cancel-all";
import { reducePosition } from "./reduce-position";
import { setTpsl } from "./set-tpsl";

export async function executePanicMode(passphrase: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const account = await db.trackedAccount.findFirst({
    where: { userId: session.userId, isActive: true },
    include: {
      positions: true,
    },
  });

  if (!account || !account.encryptedAgentKey || !account.keyIv || !account.agentKeySalt || !account.agentKeyAuthTag) {
    throw new Error("No active account or Agent credentials found.");
  }

  // 1. Decrypt the Agent private key
  const privateKey = decrypt(
    account.encryptedAgentKey,
    account.keyIv,
    account.agentKeySalt,
    account.agentKeyAuthTag,
    passphrase
  );

  if (!privateKey) {
    throw new Error("Invalid decryption passphrase. Key could not be unlocked.");
  }

  const results: any[] = [];

  try {
    // Phase 1: Cancel everything
    console.log(`[Panic] User ${session.userId} - Phase 1: Cancelling all orders...`);
    const cancelRes = await cancelAllOrders({ 
      allSymbols: true, 
      excludeReduceOnly: false,
      privateKeyBase58: privateKey,
      trackedAccountId: account.id
    });
    results.push(cancelRes);

    // Phase 2: Reduce the largest exposure position by 50%
    const sortedPositions = [...account.positions].sort((a, b) => 
      (b.size.toNumber() * b.markPrice.toNumber()) - (a.size.toNumber() * a.markPrice.toNumber())
    );

    const largest = sortedPositions[0];
    if (largest && largest.size.toNumber() > 0) {
      console.log(`[Panic] User ${session.userId} - Phase 2: Reducing largest position ${largest.symbol}...`);
      const reduceRes = await reducePosition({
        symbol: largest.symbol,
        side: largest.side,
        size: largest.size.toNumber() * 0.5,
        privateKeyBase58: privateKey,
        trackedAccountId: account.id
      });
      results.push(reduceRes);
    }

    // Phase 3: Apply hardening TP/SL to all positions (-2% SL, +5% TP)
    console.log(`[Panic] User ${session.userId} - Phase 3: Applying emergency TP/SL to all positions...`);
    for (const pos of account.positions) {
      const mark = pos.markPrice.toNumber();
      const isLong = pos.side === "LONG";
      
      const slPrice = isLong ? mark * 0.98 : mark * 1.02;
      const tpPrice = isLong ? mark * 1.05 : mark * 0.95;

      const tpslRes = await setTpsl({
        symbol: pos.symbol,
        side: pos.side,
        stopLoss: Number(slPrice.toFixed(4)),
        takeProfit: Number(tpPrice.toFixed(4)),
        privateKeyBase58: privateKey,
        trackedAccountId: account.id
      });
      results.push(tpslRes);
    }

    // Log the master Panic event
    await db.actionLog.create({
      data: {
        trackedAccountId: account.id,
        actionType: "PANIC_MODE",
        status: "SUCCESS",
        responsePayload: { sequence: results } as any,
      },
    });

    return { ok: true, sequence: results };
  } catch (error) {
    console.error(`[Panic] User ${session.userId} - Execution failed:`, error);
    await db.actionLog.create({
      data: {
        trackedAccountId: account.id,
        actionType: "PANIC_MODE",
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Panic mode failed during execution pipe",
      },
    });
    throw error;
  }
}
