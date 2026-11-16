import { readTab } from "@/lib/googleSheets";
import { SHEET_TABS } from "@/lib/constants";
import { ok, fail } from "@/lib/api";
import { buildSalesHours } from "@/lib/salesHours";

export async function GET() {
  try {
    const [qb, ff] = await Promise.all([readTab(SHEET_TABS.sales), readTab(SHEET_TABS.functionFox)]);
    return ok(buildSalesHours(qb, ff));
  } catch (e) {
    console.error("[api/sales-hours]", e);
    return fail("Unable to load Sales & Hours data from Google Sheets.");
  }
}
