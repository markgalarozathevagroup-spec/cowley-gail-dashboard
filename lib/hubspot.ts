import "server-only";

const BASE = "https://api.hubapi.com";

export class HubspotError extends Error {
  constructor(message: string, public status = 502, public existingId?: string) {
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
    if (res.status === 409) {
      const m = body.match(/Existing ID:\s*(\d+)/i);
      throw new HubspotError("HubSpot already has a record like this.", 409, m?.[1]);
    }
    throw new HubspotError(res.status === 401 || res.status === 403 ? "HubSpot rejected the access token." : `HubSpot returned an error (${res.status}).`, 502);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

import { allFields, type FieldDef, type ObjType } from "./hubspotFields";
export type { ObjType };
const PATH: Record<ObjType, string> = { company: "companies", contact: "contacts" };
const PORTAL_URL_TYPE: Record<ObjType, string> = { company: "0-2", contact: "0-1" };

/** Columns on the list view. */
export const READ_PROPS: Record<ObjType, string[]> = {
  company: ["name", "domain", "phone", "city", "state", "country", "industry", "lifecyclestage", "hs_lead_status", "project_status", "dashboard_approval_status", "createdate"],
  contact: ["firstname", "lastname", "email", "phone", "company", "jobtitle", "city", "lifecyclestage", "hs_lead_status", "createdate"],
};
const DETAIL_PROPS = (t: ObjType) => [...new Set([...allFields(t).map((f) => f.key), ...READ_PROPS[t]])];

/** Fields the dashboard may change (everything else is read-only), with how each is validated. */
const KIND = (t: ObjType, key: string): FieldDef | undefined => allFields(t).find((f) => f.key === key);

export interface HsRecord { id: string; properties: Record<string, string | null> }

export async function totals() {
  const [c, k] = await Promise.all(
    (["company", "contact"] as ObjType[]).map((t) =>
      hs<{ total: number }>(`/crm/v3/objects/${PATH[t]}/search`, { method: "POST", body: JSON.stringify({ limit: 1 }) }),
    ),
  );
  return { companies: c.total, contacts: k.total };
}

export const PAGE_SIZES = [25, 50, 100];
/** Properties a page may be sorted by (HubSpot sorts one property server-side). */
export const SORTABLE: Record<ObjType, string[]> = {
  company: ["name", "phone", "city", "state", "country", "industry", "lifecyclestage", "hs_lead_status", "project_status", "createdate"],
  contact: ["lastname", "email", "phone", "company", "jobtitle", "city", "lifecyclestage", "hs_lead_status", "createdate"],
};

/** One page of records straight from HubSpot (server-side search, sort and paging). */
export async function searchPage(type: ObjType, opts: { q: string; page: number; size: number; sort: string; dir: "ASCENDING" | "DESCENDING"; lifecycle?: string; leadStatus?: string }) {
  const filters = [
    opts.lifecycle && { propertyName: "lifecyclestage", operator: "EQ", value: opts.lifecycle },
    opts.leadStatus && { propertyName: "hs_lead_status", operator: "EQ", value: opts.leadStatus },
  ].filter(Boolean);
  const body: Record<string, unknown> = {
    limit: opts.size,
    after: String(opts.page * opts.size),
    ...(filters.length ? { filterGroups: [{ filters }] } : {}),
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
    allFields(type).filter((f) => f.kind === "enum").map(async ({ key: name }) => {
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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\-.\s]{0,40}$/;
const DOMAIN = /^([a-z0-9-]+\.)+[a-z]{2,}$/;

async function cleanProps(type: ObjType, props: Record<string, string>, max = 12): Promise<Record<string, string>> {
  const entries = Object.entries(props);
  if (!entries.length || entries.length > max) throw new HubspotError("Nothing to save.", 400);
  const options = await enumOptions(type);
  const clean: Record<string, string> = {};
  for (const [key, raw] of entries) {
    const f = KIND(type, key);
    if (!f || !["text", "enum", "email", "phone", "domain"].includes(f.kind)) throw new HubspotError(`"${key}" cannot be set from the dashboard.`, 400);
    if (typeof raw !== "string" || raw.length > 200) throw new HubspotError(`${f.label} is too long.`, 400);
    const v = raw.trim();
    if (v !== "") {
      if (f.kind === "enum" && !(options[key] ?? []).some((o) => o.value === v)) throw new HubspotError(`That is not an allowed choice for ${f.label}.`, 400);
      if (f.kind === "email" && !EMAIL.test(v)) throw new HubspotError("Please enter a valid email address.", 400);
      if (f.kind === "phone" && !PHONE.test(v)) throw new HubspotError("Phone numbers may only contain digits, spaces and + ( ) - .", 400);
      if (f.kind === "domain" && !DOMAIN.test(v.toLowerCase())) throw new HubspotError("Enter a domain like example.org.", 400);
    }
    clean[key] = f.kind === "domain" ? v.toLowerCase() : v;
  }
  return clean;
}

/** Change several fields on one record; every field is checked against the card definitions first. */
export async function updateFields(type: ObjType, id: string, props: Record<string, string>) {
  if (!/^\d{1,20}$/.test(id)) throw new HubspotError("Invalid record id.", 400);
  const clean = await cleanProps(type, props);
  await hs(`/crm/v3/objects/${PATH[type]}/${id}`, { method: "PATCH", body: JSON.stringify({ properties: clean }) });
}

// HubSpot's search index lags a few seconds behind new records, so remember what we just created.
const recentDomains = new Map<string, { id: string; at: number }>();

/** Create a company or contact. Blank values are dropped; duplicates are refused. */
export async function createRecord(type: ObjType, props: Record<string, string>): Promise<string> {
  const filled = Object.fromEntries(Object.entries(props).filter(([, v]) => typeof v !== "string" || v.trim() !== ""));
  const clean = await cleanProps(type, filled, 14);
  if (type === "company" && !clean.name && !clean.domain) throw new HubspotError("Please enter a company name or domain.", 400);
  if (type === "contact" && !clean.email && !clean.firstname && !clean.lastname) throw new HubspotError("Please enter an email address or a name.", 400);
  if (type === "company" && clean.domain) {
    const recent = recentDomains.get(clean.domain);
    if (recent && Date.now() - recent.at < 120_000) throw new HubspotError("A company with that domain already exists in HubSpot.", 409, recent.id);
    const r = await hs<{ total: number; results: { id: string }[] }>("/crm/v3/objects/companies/search", {
      method: "POST",
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: clean.domain }] }], limit: 1 }),
    });
    if (r.total > 0) throw new HubspotError("A company with that domain already exists in HubSpot.", 409, r.results[0].id);
  }
  const rec = await hs<{ id: string }>(`/crm/v3/objects/${PATH[type]}`, { method: "POST", body: JSON.stringify({ properties: clean }) });
  if (type === "company" && clean.domain) recentDomains.set(clean.domain, { id: rec.id, at: Date.now() });
  return rec.id;
}

export interface Related { id: string; name: string; sub: string }
export interface RecordDetail {
  id: string;
  properties: Record<string, string | null>;
  related: { kind: ObjType; items: Related[]; total: number };
  options: Record<string, { value: string; label: string }[]>;
  url: string;
}

export async function getRecord(type: ObjType, id: string): Promise<RecordDetail> {
  if (!/^\d{1,20}$/.test(id)) throw new HubspotError("Invalid record id.", 400);
  const other: ObjType = type === "contact" ? "company" : "contact";
  const props = DETAIL_PROPS(type).join(",");
  const [rec, assoc, options, url] = await Promise.all([
    hs<{ id: string; properties: Record<string, string | null> }>(`/crm/v3/objects/${PATH[type]}/${id}?properties=${props}`),
    hs<{ results: { toObjectId: number }[] }>(`/crm/v4/objects/${PATH[type]}/${id}/associations/${PATH[other]}?limit=100`).catch(() => ({ results: [] })),
    enumOptions(type),
    recordUrl(type),
  ]);
  const ids = assoc.results.slice(0, 25).map((a) => String(a.toObjectId));
  let items: Related[] = [];
  if (ids.length) {
    const read = other === "company" ? ["name", "domain"] : ["firstname", "lastname", "jobtitle", "email"];
    const b = await hs<{ results: { id: string; properties: Record<string, string | null> }[] }>(`/crm/v3/objects/${PATH[other]}/batch/read`, {
      method: "POST",
      body: JSON.stringify({ properties: read, inputs: ids.map((i) => ({ id: i })) }),
    });
    items = b.results.map((r) =>
      other === "company"
        ? { id: r.id, name: r.properties.name || r.properties.domain || "(no name)", sub: r.properties.domain ?? "" }
        : { id: r.id, name: [r.properties.firstname, r.properties.lastname].filter(Boolean).join(" ") || r.properties.email || "(no name)", sub: [r.properties.jobtitle, r.properties.email].filter(Boolean).join(" · ") },
    );
  }
  return { id: rec.id, properties: rec.properties, related: { kind: other, items, total: assoc.results.length }, options, url: `${url}${rec.id}` };
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
