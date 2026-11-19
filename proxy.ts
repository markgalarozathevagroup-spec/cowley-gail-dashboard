import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE, sessionToken, timingSafeEqual } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  const expected = await sessionToken();
  if (!expected) {
    // Not configured: lock down in production, stay open for local development.
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("Dashboard login is not configured.", { status: 503 });
  }

  const got = req.cookies.get(COOKIE)?.value ?? "";
  if (timingSafeEqual(got, expected)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "Please sign in." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|cowley-logo.png).*)"],
};
