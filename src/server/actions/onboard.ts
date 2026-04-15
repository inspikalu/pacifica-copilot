"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function onboardAccount(input: {
  label: string;
  pacificaAccount: string;
  agentWallet: string;
  encryptedAgentKey: string;
  keyIv: string;
  agentKeySalt: string;
  agentKeyAuthTag: string;
}) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized: No session found");
  }

  const userId = session.userId;

  // Upsert the account for this specific user
  const account = await db.trackedAccount.upsert({
    where: {
      userId_pacificaAccount: {
        userId,
        pacificaAccount: input.pacificaAccount,
      },
    },
    update: {
      label: input.label,
      agentWallet: input.agentWallet,
      encryptedAgentKey: input.encryptedAgentKey,
      keyIv: input.keyIv,
      agentKeySalt: input.agentKeySalt,
      agentKeyAuthTag: input.agentKeyAuthTag,
      isActive: true,
    },
    create: {
      userId,
      label: input.label,
      pacificaAccount: input.pacificaAccount,
      agentWallet: input.agentWallet,
      encryptedAgentKey: input.encryptedAgentKey,
      keyIv: input.keyIv,
      agentKeySalt: input.agentKeySalt,
      agentKeyAuthTag: input.agentKeyAuthTag,
      isActive: true,
    },
  });

  // Deactivate other accounts for this session (optional, can be a setting later)
  await db.trackedAccount.updateMany({
    where: {
      userId,
      id: { not: account.id },
    },
    data: { isActive: false },
  });

  revalidatePath("/");
  return { success: true, accountId: account.id };
}
