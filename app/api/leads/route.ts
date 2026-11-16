import { NextRequest } from "next/server";
import { readTab, writeCell } from "@/lib/googleSheets";
import { SHEET_TABS } from "@/lib/constants";
import { ok, fail } from "@/lib/api";
import { parseNumber } from "@/lib/formatters";
import { syncLeadApproval } from "@/lib/hubspot";
import { LEAD_STATUSES, normalizeStatus, type Lead, type LeadStatus } from "@/lib/leadTypes";

const COLS = {
  section: "Business Section",
  id: "Lead ID",
  company: "Company / Organization",
  location: "Location",
  decisionMaker: "Decision Maker",
  title: "Title / Role",
  contact: "Contact",
  website: "Website",
  revenue: "Est. Revenue / Budget",
  score: "Score (/20)",
  rating: "Rating",
  signal: "Key Buying Signal",
  status: "Status",
  webPresence: "Web Presence",
  gaps: "Key Website Gaps",
  competitors: "Top Competitors",
  services: "Cowley Services Match",
  pitch: "Recommended Pitch Angle",
} as const;

function indexColumns(header: string[]) {
  const norm = header.map((h) => (h ?? "").trim().toLowerCase());
  const idx = {} as Record<keyof typeof COLS, number>;
  for (const k of Object.keys(COLS) as (keyof typeof COLS)[]) {
    const i = norm.indexOf(COLS[k].toLowerCase());
    if (i < 0) throw new Error(`Leads sheet is missing the "${COLS[k]}" column.`);
    idx[k] = i;
  }
  return idx;
}

export async function GET() {
  try {
    const rows = await readTab(SHEET_TABS.leads);
    if (rows.length === 0) return ok({ leads: [] as Lead[] });
    const idx = indexColumns(rows[0]);
    const cell = (r: string[], k: keyof typeof COLS) => (r[idx[k]] ?? "").trim();
    const leads: Lead[] = [];
    rows.slice(1).forEach((r, i) => {
      if (!cell(r, "company")) return;
      leads.push({
        row: i + 2,
        id: cell(r, "id"),
        section: cell(r, "section"),
        company: cell(r, "company"),
        location: cell(r, "location"),
        decisionMaker: cell(r, "decisionMaker"),
        title: cell(r, "title"),
        contact: cell(r, "contact"),
        website: cell(r, "website"),
        revenue: cell(r, "revenue"),
        score: parseNumber(cell(r, "score")),
        rating: cell(r, "rating"),
        signal: cell(r, "signal"),
        status: normalizeStatus(cell(r, "status")),
        webPresence: cell(r, "webPresence"),
        gaps: cell(r, "gaps"),
        competitors: cell(r, "competitors"),
        services: cell(r, "services"),
        pitch: cell(r, "pitch"),
      });
    });
    return ok({ leads });
  } catch (e) {
    console.error("[api/leads GET]", e);
    return fail("Unable to load Leads from Google Sheets.");
  }
}

/** Body: { row: number, leadId: string, status: "Approved" | "Not Approved" | "Pending Review" } */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.", 400);
  }
  const b = body as { row?: unknown; leadId?: unknown; status?: unknown };
  if (!Number.isInteger(b.row) || (b.row as number) < 2) return fail("Invalid row.", 400);
  if (typeof b.leadId !== "string" || !b.leadId) return fail("Missing lead ID.", 400);
  if (typeof b.status !== "string" || !LEAD_STATUSES.includes(b.status as LeadStatus)) {
    return fail("Invalid status.", 400);
  }
  const row = b.row as number;
  try {
    const rows = await readTab(SHEET_TABS.leads);
    const idx = indexColumns(rows[0] ?? []);
    const target = rows[row - 1];
    if (!target || (target[idx.id] ?? "").trim() !== b.leadId) {
      return fail("That lead has moved or changed in the sheet. Please refresh and try again.", 409);
    }
    await writeCell(SHEET_TABS.leads, idx.status, row, b.status as string);
    // Sheet is saved; now mirror the decision onto the matching HubSpot company (never fails the request).
    const websiteCol = rows[0].findIndex((h) => h.trim().toLowerCase() === "website");
    const hubspot = await syncLeadApproval(websiteCol >= 0 ? target[websiteCol] ?? "" : "", b.status as LeadStatus);
    return ok({ row, status: b.status, hubspot });
  } catch (e) {
    console.error("[api/leads PATCH]", e);
    return fail("Unable to save the change to Google Sheets.");
  }
}
