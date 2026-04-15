import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reducePosition } from "@/server/actions/reduce-position";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

const schema = z.object({
  symbol: z.string().min(1),
  side: z.enum(["LONG", "SHORT"]),
  size: z.number().positive(),
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
    const result = await reducePosition({
      ...payload,
      privateKeyBase58: privateKey,
      trackedAccountId: account.id
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reduce position." },
      { status: 400 },
    );
  }
}
