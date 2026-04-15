import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cancelAllOrders } from "@/server/actions/cancel-all";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

const schema = z.object({
  allSymbols: z.boolean().default(true),
  excludeReduceOnly: z.boolean().default(false),
  passphrase: z.string().min(1), // Required to unlock Agent
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = schema.parse(await request.json());

    // 1. Find the user's active account
    const account = await db.trackedAccount.findFirst({
      where: { userId: session.userId, isActive: true },
    });

    if (!account || !account.encryptedAgentKey || !account.keyIv || !account.agentKeySalt || !account.agentKeyAuthTag) {
      return NextResponse.json({ error: "No active Agent configured." }, { status: 404 });
    }

    // 2. Unlock the key
    const privateKey = decrypt(
      account.encryptedAgentKey,
      account.keyIv,
      account.agentKeySalt,
      account.agentKeyAuthTag,
      payload.passphrase
    );

    if (!privateKey) {
      return NextResponse.json({ error: "Invalid passphrase. Agent locked." }, { status: 403 });
    }

    // 3. Execute
    const result = await cancelAllOrders({
      ...payload,
      privateKeyBase58: privateKey,
      trackedAccountId: account.id
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to cancel orders." },
      { status: 400 },
    );
  }
}
