import { NextRequest, NextResponse } from "next/server";
import { COOKIE, MAX_AGE, passwordMatches, sessionToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let password = "";
  try {
    const b = await req.json();
    if (typeof b.password === "string") password = b.password.slice(0, 200);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }
  const token = await sessionToken();
  if (!token) return NextResponse.json({ success: false, error: "Login is not configured." }, { status: 503 });

  if (!(await passwordMatches(password))) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return NextResponse.json({ success: false, error: "That password is not correct." }, { status: 401 });
  }
  const res = NextResponse.json({ success: true, data: {} });
  res.cookies.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
  return res;
}
