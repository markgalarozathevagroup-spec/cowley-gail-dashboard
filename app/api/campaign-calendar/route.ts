import { NextRequest } from "next/server";
import { readTab, writeCell } from "@/lib/googleSheets";
import { SHEET_TABS } from "@/lib/constants";
import { ok, fail } from "@/lib/api";
import { LEAD_STATUSES, normalizeStatus, type LeadStatus } from "@/lib/leadTypes";

export interface CalendarItem {
  row: number;
  month: string;
  segment: string;
  type: string;
  theme: string;
  description: string;
  timing: string;
  format: string;
  pdfUrl: string;
  feedback: string;
  status: LeadStatus;
}

const COLS = {
  month: "Month",
  segment: "Segment",
  type: "Type",
  theme: "Theme",
  status: "Status",
  description: "Description",
  timing: "Timing",
  format: "Format",
  pdfUrl: "PDF URL",
  feedback: "Gail's Feedback",
} as const;

function indexColumns(header: string[]) {
  const norm = header.map((h) => (h ?? "").trim().toLowerCase());
  const idx = {} as Record<keyof typeof COLS, number>;
  for (const k of Object.keys(COLS) as (keyof typeof COLS)[]) {
    const i = norm.indexOf(COLS[k].toLowerCase());
    if (i < 0) throw new Error(`Campaign Calendar is missing the "${COLS[k]}" column.`);
    idx[k] = i;
  }
  return idx;
}

export async function GET() {
  try {
    const rows = await readTab(SHEET_TABS.calendar);
    if (!rows.length) return ok({ items: [] as CalendarItem[] });
    const idx = indexColumns(rows[0]);
    const cell = (r: string[], k: keyof typeof COLS) => (r[idx[k]] ?? "").trim();
    const items: CalendarItem[] = [];
    rows.slice(1).forEach((r, i) => {
      if (!cell(r, "theme") && !cell(r, "month")) return;
      items.push({
        row: i + 2,
        month: cell(r, "month"),
        segment: cell(r, "segment"),
        type: cell(r, "type"),
        theme: cell(r, "theme"),
        description: cell(r, "description"),
        timing: cell(r, "timing"),
        format: cell(r, "format"),
        pdfUrl: cell(r, "pdfUrl"),
        feedback: r[idx.feedback] ?? "",
        status: normalizeStatus(cell(r, "status")),
      });
    });
    return ok({ items });
  } catch (e) {
    console.error("[api/campaign-calendar GET]", e);
    return fail("Unable to load the Campaign Calendar from Google Sheets.");
  }
}

/** Body: { row, theme, status?: LeadStatus, feedback?: string } — theme must match the row (stale-row guard). */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body.", 400);
  }
  const b = body as { row?: unknown; theme?: unknown; status?: unknown; feedback?: unknown };
  if (!Number.isInteger(b.row) || (b.row as number) < 2) return fail("Invalid row.", 400);
  if (typeof b.theme !== "string" || !b.theme) return fail("Missing campaign theme.", 400);
  const hasStatus = b.status !== undefined;
  const hasFeedback = b.feedback !== undefined;
  if (!hasStatus && !hasFeedback) return fail("Nothing to update.", 400);
  if (hasStatus && (typeof b.status !== "string" || !LEAD_STATUSES.includes(b.status as LeadStatus))) {
    return fail("Invalid status.", 400);
  }
  if (hasFeedback && (typeof b.feedback !== "string" || b.feedback.length > 5000)) {
    return fail("Feedback must be text under 5,000 characters.", 400);
  }
  const row = b.row as number;
  try {
    const rows = await readTab(SHEET_TABS.calendar);
    const idx = indexColumns(rows[0] ?? []);
    const target = rows[row - 1];
    if (!target || (target[idx.theme] ?? "").trim() !== b.theme) {
      return fail("That campaign has moved or changed in the sheet. Please refresh and try again.", 409);
    }
    if (hasStatus) await writeCell(SHEET_TABS.calendar, idx.status, row, b.status as string);
    if (hasFeedback) await writeCell(SHEET_TABS.calendar, idx.feedback, row, b.feedback as string);
    return ok({ row });
  } catch (e) {
    console.error("[api/campaign-calendar PATCH]", e);
    return fail("Unable to save the change to Google Sheets.");
  }
}
