import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executePanicMode } from "@/server/actions/panic-mode";
import { getSession } from "@/lib/session";

const schema = z.object({
  passphrase: z.string().min(1), // Required to unlock Agent for sequence
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = schema.parse(await request.json());

    const result = await executePanicMode(payload.passphrase);

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Panic mode failed." },
      { status: 400 },
    );
  }
}
