import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { HubspotError, getRecord } from "@/lib/hubspot";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("type");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (t !== "company" && t !== "contact") return fail("Invalid record type.", 400);
  try {
    return ok(await getRecord(t, id));
  } catch (e) {
    console.error("[api/hubspot/record]", e);
    if (e instanceof HubspotError) return fail(e.message, e.status);
    return fail("Unable to load this record from HubSpot.", 500);
  }
}
