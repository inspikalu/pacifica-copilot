import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { connectTrackedAccount, getDashboardData } from "@/server/queries/dashboard";

const schema = z.object({
  label: z.string().min(1),
  pacificaAccount: z.string().min(8),
  agentWallet: z.string().min(8).optional(),
});

export async function GET() {
  const data = await getDashboardData();
  return NextResponse.json({ data: data.account });
}

export async function POST(request: NextRequest) {
  try {
    const payload = schema.parse(await request.json());
    const account = await connectTrackedAccount(payload);

    return NextResponse.json({
      data: {
        id: account.id,
        label: account.label,
        pacificaAccount: account.pacificaAccount,
        agentWallet: account.agentWallet,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update tracked account." },
      { status: 400 },
    );
  }
}
