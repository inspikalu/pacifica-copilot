import { NextResponse } from "next/server";
import crypto from "node:crypto";

export async function GET() {
  // Generate a random high-entropy nonce
  const nonce = crypto.randomUUID();
  
  return NextResponse.json({
    nonce,
    domain: "localhost:3000", // In production this would be env.DOMAIN
    statement: "Sign in to Pacifica Risk Copilot to manage your intelligent risk thresholds.",
    uri: "http://localhost:3000",
    version: "1",
    chainId: "mainnet", // Optional: can be devnet/mainnet
  });
}
