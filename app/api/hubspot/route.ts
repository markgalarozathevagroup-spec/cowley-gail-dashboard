import { readTab } from "@/lib/googleSheets";
import { SHEET_TABS } from "@/lib/constants";
import { ok, fail } from "@/lib/api";

export interface HubspotCompany {
  name: string;
  projectStatus: string;
  leadStatus: string;
  lifecycle: string;
  city: string;
  state: string;
  industry: string;
  domain: string;
  created: string;
}

export interface HubspotData {
  companies: number;
  contacts: number;
  lifecycle: Record<string, number>;
  companyList: HubspotCompany[];
}

/** The tab stacks sections: a one-cell title row (CONTACTS / COMPANIES), a header row, data rows, then a blank row. */
function section(rows: string[][], title: string): { header: string[]; data: string[][] } | null {
  const start = rows.findIndex((r) => r.length === 1 && r[0].trim().toUpperCase() === title);
  if (start < 0 || !rows[start + 1]) return null;
  const header = rows[start + 1];
  const data: string[][] = [];
  for (const r of rows.slice(start + 2)) {
    if (!r.some((c) => (c ?? "").trim())) break;
    data.push(r);
  }
  return { header, data };
}

export async function GET() {
  try {
    const rows = await readTab(SHEET_TABS.hubspot);
    const comp = section(rows, "COMPANIES");
    const cont = section(rows, "CONTACTS");
    if (!comp) return fail("The Hubspot tab has no COMPANIES section.", 502);
    const col = (h: string[], name: string) => h.findIndex((x) => x.trim().toLowerCase() === name.toLowerCase());
    const c = (r: string[], name: string) => (r[col(comp.header, name)] ?? "").trim();
    const companyList: HubspotCompany[] = comp.data
      .filter((r) => (r[0] ?? "").trim())
      .map((r) => ({
        name: c(r, "Name"),
        projectStatus: c(r, "Project Status"),
        leadStatus: c(r, "Lead Status"),
        lifecycle: c(r, "Lifecycle"),
        city: c(r, "City"),
        state: c(r, "State"),
        industry: c(r, "Industry"),
        domain: c(r, "Domain"),
        created: c(r, "Created"),
      }));
    const lifecycle: Record<string, number> = {};
    for (const co of companyList) {
      const k = co.lifecycle || "unspecified";
      lifecycle[k] = (lifecycle[k] ?? 0) + 1;
    }
    // HubSpot's built-in "(Sample Contact)" records are not real contacts.
    const contacts = (cont?.data ?? []).filter((r) => !/sample contact/i.test(r.join(" "))).length;
    const data: HubspotData = { companies: companyList.length, contacts, lifecycle, companyList };
    return ok(data);
  } catch (e) {
    console.error("[api/hubspot]", e);
    return fail("Unable to load Hubspot data from Google Sheets.");
  }
}
