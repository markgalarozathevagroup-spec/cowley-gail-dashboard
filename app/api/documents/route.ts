import { NextRequest } from "next/server";
import { appendRow, readTab, writeCell } from "@/lib/googleSheets";
import { SHEET_TABS } from "@/lib/constants";
import { ok, fail } from "@/lib/api";
import { LEAD_STATUSES, normalizeStatus, type LeadStatus } from "@/lib/leadTypes";
import { isHttpUrl, type DocItem } from "@/lib/docTypes";

// Fixed column positions in the Documents tab: Title, Purpose, Link, Status
const COL = { title: 0, purpose: 1, link: 2, status: 3 } as const;
type Field = keyof typeof COL;
const MAX = { title: 300, purpose: 3000, link: 2000 };

export async function GET() {
  try {
    const rows = await readTab(SHEET_TABS.documents);
    const items: DocItem[] = [];
    rows.slice(1).forEach((r, i) => {
      if (!(r[COL.title] ?? "").trim()) return;
      items.push({
        row: i + 2,
        title: r[COL.title].trim(),
        purpose: (r[COL.purpose] ?? "").trim(),
        link: (r[COL.link] ?? "").trim(),
        status: normalizeStatus(r[COL.status]),
      });
    });
    return ok({ items });
  } catch (e) {
    console.error("[api/documents GET]", e);
    return fail("Unable to load the Document Library from Google Sheets.");
  }
}

/** Body: { row, expectedTitle, field: "title"|"purpose"|"link"|"status", value } */
export async function PATCH(req: NextRequest) {
  let b: { row?: unknown; expectedTitle?: unknown; field?: unknown; value?: unknown };
  try {
    b = await req.json();
  } catch {
    return fail("Invalid request body.", 400);
  }
  if (!Number.isInteger(b.row) || (b.row as number) < 2) return fail("Invalid row.", 400);
  if (typeof b.expectedTitle !== "string" || !b.expectedTitle) return fail("Missing document title.", 400);
  if (typeof b.field !== "string" || !(b.field in COL)) return fail("Invalid field.", 400);
  if (typeof b.value !== "string") return fail("Invalid value.", 400);
  const field = b.field as Field;
  const value = b.value.trim();
  if (field === "status" && !LEAD_STATUSES.includes(value as LeadStatus)) return fail("Invalid status.", 400);
  if (field === "title" && !value) return fail("Title cannot be empty.", 400);
  if (field === "link" && value && !isHttpUrl(value)) return fail("Link must start with http:// or https://.", 400);
  if (field !== "status" && value.length > MAX[field]) return fail(`That ${field} is too long.`, 400);
  const row = b.row as number;
  try {
    const rows = await readTab(SHEET_TABS.documents);
    if ((rows[row - 1]?.[COL.title] ?? "").trim() !== b.expectedTitle) {
      return fail("That document has moved or changed in the sheet. Please refresh and try again.", 409);
    }
    await writeCell(SHEET_TABS.documents, COL[field], row, value);
    return ok({ row });
  } catch (e) {
    console.error("[api/documents PATCH]", e);
    return fail("Unable to save the change to Google Sheets.");
  }
}

/** Body: { title, purpose?, link? } — appended as a new Pending Review row. */
export async function POST(req: NextRequest) {
  let b: { title?: unknown; purpose?: unknown; link?: unknown };
  try {
    b = await req.json();
  } catch {
    return fail("Invalid request body.", 400);
  }
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const purpose = b.purpose === undefined ? "" : typeof b.purpose === "string" ? b.purpose.trim() : null;
  const link = b.link === undefined ? "" : typeof b.link === "string" ? b.link.trim() : null;
  if (!title || title.length > MAX.title) return fail("Please enter a title.", 400);
  if (purpose === null || purpose.length > MAX.purpose) return fail("Invalid purpose.", 400);
  if (link === null || link.length > MAX.link || (link && !isHttpUrl(link))) return fail("Link must start with http:// or https://.", 400);
  try {
    const row = await appendRow(SHEET_TABS.documents, [title, purpose, link, "Pending Review"]);
    const item: DocItem = { row, title, purpose, link, status: "Pending Review" };
    return ok({ item });
  } catch (e) {
    console.error("[api/documents POST]", e);
    return fail("Unable to add the document to Google Sheets.");
  }
}
