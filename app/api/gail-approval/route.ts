import { NextRequest } from "next/server";
import { readTab, writeCell } from "@/lib/googleSheets";
import { SHEET_TABS } from "@/lib/constants";
import { ok, fail } from "@/lib/api";
import { GAIL_STATUSES, type GailItem, type GailStatus } from "@/lib/docTypes";

// Gail Approval columns: Report Date, Source Report, Item, What Gail Needs To Do, Status, Notes
const COL = { date: 0, source: 1, item: 2, todo: 3, status: 4, notes: 5 } as const;

function toStatus(v: string | undefined): GailStatus {
  const s = (v ?? "").trim().toLowerCase();
  return GAIL_STATUSES.find((g) => g.toLowerCase() === s) ?? "Needs Gail";
}

export async function GET() {
  try {
    const rows = await readTab(SHEET_TABS.gailApproval);
    const items: GailItem[] = [];
    rows.slice(1).forEach((r, i) => {
      if (!(r[COL.item] ?? "").trim()) return;
      items.push({
        row: i + 2,
        date: (r[COL.date] ?? "").trim(),
        source: (r[COL.source] ?? "").trim(),
        item: r[COL.item].trim(),
        todo: (r[COL.todo] ?? "").trim(),
        status: toStatus(r[COL.status]),
        notes: r[COL.notes] ?? "",
      });
    });
    return ok({ items });
  } catch (e) {
    console.error("[api/gail-approval GET]", e);
    return fail("Unable to load Gail Approval items from Google Sheets.");
  }
}

/** Body: { row, item, status?, notes? } — item must match the row (stale-row guard). */
export async function PATCH(req: NextRequest) {
  let b: { row?: unknown; item?: unknown; status?: unknown; notes?: unknown };
  try {
    b = await req.json();
  } catch {
    return fail("Invalid request body.", 400);
  }
  if (!Number.isInteger(b.row) || (b.row as number) < 2) return fail("Invalid row.", 400);
  if (typeof b.item !== "string" || !b.item) return fail("Missing item name.", 400);
  const hasStatus = b.status !== undefined;
  const hasNotes = b.notes !== undefined;
  if (!hasStatus && !hasNotes) return fail("Nothing to update.", 400);
  if (hasStatus && (typeof b.status !== "string" || !GAIL_STATUSES.includes(b.status as GailStatus))) return fail("Invalid status.", 400);
  if (hasNotes && (typeof b.notes !== "string" || b.notes.length > 5000)) return fail("Notes must be text under 5,000 characters.", 400);
  const row = b.row as number;
  try {
    const rows = await readTab(SHEET_TABS.gailApproval);
    if ((rows[row - 1]?.[COL.item] ?? "").trim() !== b.item) {
      return fail("That item has moved or changed in the sheet. Please refresh and try again.", 409);
    }
    if (hasStatus) await writeCell(SHEET_TABS.gailApproval, COL.status, row, b.status as string);
    if (hasNotes) await writeCell(SHEET_TABS.gailApproval, COL.notes, row, b.notes as string);
    return ok({ row });
  } catch (e) {
    console.error("[api/gail-approval PATCH]", e);
    return fail("Unable to save the change to Google Sheets.");
  }
}
