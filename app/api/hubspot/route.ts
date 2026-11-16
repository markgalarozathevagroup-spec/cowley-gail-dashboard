import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { EDITABLE, HubspotError, PAGE_SIZE, SORTABLE, enumOptions, recordUrl, searchPage, totals, updateField, type HsRecord, type ObjType } from "@/lib/hubspot";

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
    const page = Math.max(0, Math.min(190, parseInt(sp.get("page") ?? "0", 10) || 0)); // HubSpot search reaches 10,000 records
    const sort = sp.get("sort") ?? (type === "company" ? "name" : "lastname");
    if (!SORTABLE[type].includes(sort)) return fail("That column cannot be sorted.", 400);
    const q = (sp.get("q") ?? "").trim().slice(0, 100);
    const dir = sp.get("dir") === "desc" ? "DESCENDING" : "ASCENDING";
    const [res, options, url] = await Promise.all([searchPage(type, { q, page, sort, dir }), enumOptions(type), recordUrl(type)]);
    const data: HubspotPage = { type, total: res.total, page, pageSize: PAGE_SIZE, records: res.records, options, recordUrl: url };
    return ok(data);
  } catch (e) {
    console.error("[api/hubspot GET]", e);
    return fail(errMsg(e, "Unable to load data from HubSpot."), errStatus(e));
  }
}

/** Body: { type: "company"|"contact", id: string, field: string, value: string } */
export async function PATCH(req: NextRequest) {
  let b: { type?: unknown; id?: unknown; field?: unknown; value?: unknown };
  try {
    b = await req.json();
  } catch {
    return fail("Invalid request body.", 400);
  }
  if (b.type !== "company" && b.type !== "contact") return fail("Invalid record type.", 400);
  if (typeof b.id !== "string" || typeof b.field !== "string" || typeof b.value !== "string") return fail("Invalid request.", 400);
  if (!(b.field in EDITABLE[b.type])) return fail("That field cannot be changed from the dashboard.", 400);
  try {
    await updateField(b.type, b.id, b.field, b.value);
    return ok({ id: b.id });
  } catch (e) {
    console.error("[api/hubspot PATCH]", e);
    return fail(errMsg(e, "Unable to save the change to HubSpot."), errStatus(e));
  }
}
