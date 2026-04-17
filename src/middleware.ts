import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // 1. Define public and onboarding paths
  const isPublicPath = path === "/onboard" || path.startsWith("/api/auth") || path.startsWith("/report");
  
  // 2. Get the session from cookies
  const cookie = request.cookies.get("session")?.value;
  const session = await decrypt(cookie);

  // 3. Redirect logic
  if (path === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }

  if (!isPublicPath && !session) {
    return NextResponse.redirect(new URL("/onboard", request.nextUrl));
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes except /api/actions)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
