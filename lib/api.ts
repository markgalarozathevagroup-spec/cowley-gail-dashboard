import { NextResponse } from "next/server";

export const ok = <T,>(data: T) => NextResponse.json({ success: true, data });

export function fail(error: string, status = 500) {
  return NextResponse.json({ success: false, error }, { status });
}
