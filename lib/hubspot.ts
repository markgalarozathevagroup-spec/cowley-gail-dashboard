import "server-only";

const BASE = "https://api.hubapi.com";

export class HubspotError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

async function hs<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new HubspotError("HubSpot is not configured on the server.", 503);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[hubspot]", res.status, path, body.slice(0, 300));
    throw new HubspotError(res.status === 401 || res.status === 403 ? "HubSpot rejected the access token." : `HubSpot returned an error (${res.status}).`, 502);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export type ObjType = "company" | "contact";
const PATH: Record<ObjType, string> = { company: "companies", contact: "contacts" };
const PORTAL_URL_TYPE: Record<ObjType, string> = { company: "0-2", contact: "0-1" };

export const READ_PROPS: Record<ObjType, string[]> = {
  company: ["name", "domain", "industry", "city", "state", "lifecyclestage", "hs_lead_status", "project_status", "dashboard_approval_status", "createdate"],
  contact: ["firstname", "lastname", "email", "jobtitle", "company", "city", "lifecyclestage", "createdate"],
};

/** Fields the dashboard is allowed to change, and how each is validated. */
export const EDITABLE: Record<ObjType, Record<string, "text" | "enum">> = {
  company: { hs_lead_status: "enum", lifecyclestage: "enum", project_status: "enum", industry: "enum", city: "text", state: "text" },
  contact: { jobtitle: "text", lifecyclestage: "enum", company: "text" },
};

export interface HsRecord { id: string; properties: Record<string, string | null> }

export async function totals() {
  const [c, k] = await Promise.all(
    (["company", "contact"] as ObjType[]).map((t) =>
      hs<{ total: number }>(`/crm/v3/objects/${PATH[t]}/search`, { method: "POST", body: JSON.stringify({ limit: 1 }) }),
    ),
  );
  return { companies: c.total, contacts: k.total };
}

export const PAGE_SIZE = 50;
/** Properties a page may be sorted by (HubSpot sorts one property server-side). */
export const SORTABLE: Record<ObjType, string[]> = {
  company: ["name", "hs_lead_status", "lifecyclestage", "project_status", "industry", "city", "state", "createdate"],
  contact: ["lastname", "jobtitle", "company", "city", "lifecyclestage", "email", "createdate"],
};

/** One page of records straight from HubSpot (server-side search, sort and paging). */
export async function searchPage(type: ObjType, opts: { q: string; page: number; sort: string; dir: "ASCENDING" | "DESCENDING" }) {
  const body: Record<string, unknown> = {
    limit: PAGE_SIZE,
    after: String(opts.page * PAGE_SIZE),
    properties: READ_PROPS[type],
    sorts: [{ propertyName: opts.sort, direction: opts.dir }],
  };
  if (opts.q) body.query = opts.q;
  const r = await hs<{ total: number; results: { id: string; properties: Record<string, string | null> }[] }>(`/crm/v3/objects/${PATH[type]}/search`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const keep = new Set(READ_PROPS[type]);
  const records: HsRecord[] = r.results.map((x) => ({
    id: x.id,
    properties: Object.fromEntries(Object.entries(x.properties).filter(([k]) => keep.has(k))),
  }));
  return { total: r.total, records };
}

const optCache: Partial<Record<ObjType, { at: number; data: Record<string, { value: string; label: string }[]> }>> = {};

export async function enumOptions(type: ObjType): Promise<Record<string, { value: string; label: string }[]>> {
  const hit = optCache[type];
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.data;
  const out: Record<string, { value: string; label: string }[]> = {};
  await Promise.all(
    Object.entries(EDITABLE[type]).filter(([, k]) => k === "enum").map(async ([name]) => {
      const p = await hs<{ options: { value: string; label: string; hidden?: boolean }[] }>(`/crm/v3/properties/${PATH[type]}/${name}`);
      out[name] = p.options.filter((o) => !o.hidden).map(({ value, label }) => ({ value, label }));
    }),
  );
  optCache[type] = { at: Date.now(), data: out };
  return out;
}

let portal: number | null = null;
export async function portalId(): Promise<number> {
  if (portal) return portal;
  portal = (await hs<{ portalId: number }>("/account-info/v3/details")).portalId;
  return portal;
}

export async function recordUrl(type: ObjType) {
  return `https://app.hubspot.com/contacts/${await portalId()}/record/${PORTAL_URL_TYPE[type]}/`;
}

export function invalidateCache() {}

export async function updateField(type: ObjType, id: string, field: string, value: string) {
  const kind = EDITABLE[type][field];
  if (!kind) throw new HubspotError("That field cannot be changed from the dashboard.", 400);
  if (!/^\d{1,20}$/.test(id)) throw new HubspotError("Invalid record id.", 400);
  if (value.length > 200) throw new HubspotError("That value is too long.", 400);
  if (kind === "enum" && value !== "") {
    const opts = (await enumOptions(type))[field] ?? [];
    if (!opts.some((o) => o.value === value)) throw new HubspotError("That is not an allowed choice for this field.", 400);
  }
  await hs(`/crm/v3/objects/${PATH[type]}/${id}`, { method: "PATCH", body: JSON.stringify({ properties: { [field]: value } }) });
  invalidateCache();
}

/** Normalise "https://www.Example.org/about" -> "example.org". */
export function domainOf(website: string): string {
  return website.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
}

export type SyncResult = { status: "updated" | "not_found" | "ambiguous" | "skipped" | "error"; detail?: string };

/** Mirror a lead decision onto the HubSpot company with the same domain. Never creates companies. */
export async function syncLeadApproval(website: string, status: "Approved" | "Not Approved" | "Pending Review"): Promise<SyncResult> {
  const domain = domainOf(website);
  if (!domain || !domain.includes(".")) return { status: "skipped", detail: "No website on this lead." };
  try {
    const r = await hs<{ total: number; results: { id: string }[] }>("/crm/v3/objects/companies/search", {
      method: "POST",
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: domain }] }], limit: 2, properties: ["name"] }),
    });
    if (r.total === 0) return { status: "not_found", detail: `No HubSpot company with domain ${domain}.` };
    if (r.total > 1) return { status: "ambiguous", detail: `More than one HubSpot company uses ${domain}; none were changed.` };
    const value = status === "Approved" ? "approved" : status === "Not Approved" ? "not_approved" : "";
    await hs(`/crm/v3/objects/companies/${r.results[0].id}`, { method: "PATCH", body: JSON.stringify({ properties: { dashboard_approval_status: value } }) });
    invalidateCache();
    return { status: "updated" };
  } catch (e) {
    return { status: "error", detail: e instanceof Error ? e.message : "HubSpot sync failed." };
  }
}
