import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api";
import { HubspotError, PAGE_SIZES, createRecord, SORTABLE, enumOptions, recordUrl, searchPage, totals, updateFields, type HsRecord, type ObjType } from "@/lib/hubspot";

export const maxDuration = 30;

export type HubspotRecord = HsRecord;

export interface HubspotPage {
  type: ObjType;
  total: number;
  page: number;
  pageSize: number;
  records: HubspotRecord[];
  options: Record<string, { value: string; label: string }[]>;
  recordUrl: string;
}

export interface HubspotSummary {
  companies: number;
  contacts: number;
}

const errStatus = (e: unknown) => (e instanceof HubspotError ? e.status : 500);
const errMsg = (e: unknown, fallback: string) => (e instanceof HubspotError ? e.message : fallback);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.get("summary")) return ok(await totals());
    const type: ObjType = sp.get("type") === "contact" ? "contact" : "company";
    const size = PAGE_SIZES.includes(Number(sp.get("size"))) ? Number(sp.get("size")) : 25;
    const page = Math.max(0, Math.min(Math.floor(9900 / size), parseInt(sp.get("page") ?? "0", 10) || 0)); // HubSpot search reaches 10,000 records
    const sort = sp.get("sort") ?? "createdate";
    if (!SORTABLE[type].includes(sort)) return fail("That column cannot be sorted.", 400);
    const q = (sp.get("q") ?? "").trim().slice(0, 100);
    const dir = sp.get("dir") === "asc" ? "ASCENDING" : "DESCENDING";
    const options = await enumOptions(type);
    const pick = (name: string, field: string) => {
      const v = sp.get(name) ?? "";
      return v && (options[field] ?? []).some((o) => o.value === v) ? v : undefined;
    };
    const [res, url] = await Promise.all([
      searchPage(type, { q, page, size, sort, dir, lifecycle: pick("lifecycle", "lifecyclestage"), leadStatus: pick("leadStatus", "hs_lead_status") }),
      recordUrl(type),
    ]);
    const data: HubspotPage = { type, total: res.total, page, pageSize: size, records: res.records, options, recordUrl: url };
    return ok(data);
  } catch (e) {
    console.error("[api/hubspot GET]", e);
    return fail(errMsg(e, "Unable to load data from HubSpot."), errStatus(e));
  }
}

/** Body: { type: "company"|"contact", id: string, properties: { [field]: string } } */
export async function PATCH(req: NextRequest) {
  let b: { type?: unknown; id?: unknown; properties?: unknown };
  try {
    b = await req.json();
  } catch {
    return fail("Invalid request body.", 400);
  }
  if (b.type !== "company" && b.type !== "contact") return fail("Invalid record type.", 400);
  if (typeof b.id !== "string") return fail("Invalid request.", 400);
  if (typeof b.properties !== "object" || b.properties === null || Array.isArray(b.properties)) return fail("Invalid request.", 400);
  try {
    await updateFields(b.type, b.id, b.properties as Record<string, string>);
    return ok({ id: b.id });
  } catch (e) {
    console.error("[api/hubspot PATCH]", e);
    return fail(errMsg(e, "Unable to save the change to HubSpot."), errStatus(e));
  }
}

/** Body: { type: "company"|"contact", properties: { [field]: string } } — creates a record in HubSpot. */
export async function POST(req: NextRequest) {
  let b: { type?: unknown; properties?: unknown };
  try {
    b = await req.json();
  } catch {
    return fail("Invalid request body.", 400);
  }
  if (b.type !== "company" && b.type !== "contact") return fail("Invalid record type.", 400);
  if (typeof b.properties !== "object" || b.properties === null || Array.isArray(b.properties)) return fail("Invalid request.", 400);
  try {
    const id = await createRecord(b.type, b.properties as Record<string, string>);
    return ok({ id });
  } catch (e) {
    console.error("[api/hubspot POST]", e);
    if (e instanceof HubspotError && e.status === 409) {
      return NextResponse.json({ success: false, error: e.message, existingId: e.existingId }, { status: 409 });
    }
    return fail(errMsg(e, "Unable to create the record in HubSpot."), errStatus(e));
  }
}
