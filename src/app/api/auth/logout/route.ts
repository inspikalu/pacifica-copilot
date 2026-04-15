import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * SECURE LOGOUT: Clears the session JWT from HttpOnly cookies.
 */
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  
  return NextResponse.json({ success: true });
}
