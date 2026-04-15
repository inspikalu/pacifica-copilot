import { NextResponse } from "next/server";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { encrypt } from "@/lib/session";
import { cookies } from "next/headers";

/**
 * Verifies a SIWS signature manually using tweetnacl to ensure compatibility
 * with all wallets (standard SIWS + vanilla signMessage).
 */
export async function POST(req: Request) {
  try {
    const { input, output } = await req.json();

    // 1. Reconstruct the exact message that was signed in the client
    const message = `${input.statement}\n\nDomain: ${input.domain}\nNonce: ${input.nonce}\nAddress: ${output.account.address}`;
    const messageBytes = new TextEncoder().encode(message);

    // 2. Decode the signature and public key
    const signatureBytes = bs58.decode(output.signature);
    const publicKeyBytes = bs58.decode(output.account.address);

    // 3. Verify ed25519 signature
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );

    if (!isValid) {
      console.warn("[Auth] Invalid signature for address:", output.account.address);
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 401 }
      );
    }

    // 4. Extracts public key string from the verified account
    const userId = output.account.address;

    // 5. Create a session expiration (7 days from now)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = await encrypt({ userId, expiresAt });

    // 6. Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set("session", session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ 
      success: true, 
      address: userId 
    });
  } catch (error) {
    console.error("[Auth] Verification error:", error);
    return NextResponse.json(
      { error: "Internal authentication error" },
      { status: 500 }
    );
  }
}
