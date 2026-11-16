"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { HubspotPage } from "@/app/api/hubspot/route";
import { fmtInt } from "@/lib/formatters";
import { initials, recordName } from "@/lib/hubspotUi";
import ErrorState from "./ErrorState";

type Tab = "company" | "contact";
type Col = { key: string; label: string; sort?: string; kind?: "enum" | "date" | "email" | "phone" };

const COLS: Record<Tab, Col[]> = {
  contact: [
    { key: "name", label: "Name", sort: "lastname" },
    { key: "email", label: "Email", sort: "email", kind: "email" },
    { key: "phone", label: "Phone Number", sort: "phone" },
    { key: "company", label: "Company name", sort: "company" },
    { key: "jobtitle", label: "Job title", sort: "jobtitle" },
    { key: "city", label: "City", sort: "city" },
    { key: "lifecyclestage", label: "Lifecycle stage", sort: "lifecyclestage", kind: "enum" },
    { key: "hs_lead_status", label: "Lead status", sort: "hs_lead_status", kind: "enum" },
    { key: "createdate", label: "Create date", sort: "createdate", kind: "date" },
  ],
  company: [
    { key: "name", label: "Name", sort: "name" },
    { key: "phone", label: "Phone Number", sort: "phone" },
    { key: "city", label: "City", sort: "city" },
    { key: "state", label: "State/Region", sort: "state" },
    { key: "country", label: "Country/Region", sort: "country" },
    { key: "industry", label: "Industry", sort: "industry", kind: "enum" },
    { key: "lifecyclestage", label: "Lifecycle stage", sort: "lifecyclestage", kind: "enum" },
    { key: "hs_lead_status", label: "Lead status", sort: "hs_lead_status", kind: "enum" },
    { key: "project_status", label: "Project status", sort: "project_status", kind: "enum" },
    { key: "createdate", label: "Create date", sort: "createdate", kind: "date" },
  ],
};

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

function pageNumbers(page: number, pages: number): number[] {
  const start = Math.max(0, Math.min(page - 4, pages - 10));
  return Array.from({ length: Math.min(10, pages) }, (_, i) => start + i);
}

export default function Hubspot() {
  const [tab, setTab] = useState<Tab>("contact");
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [lifecycle, setLifecycle] = useState("");
  const [leadStatus, setLeadStatus] = useState("");
  const [sort, setSort] = useState("createdate");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [data, setData] = useState<HubspotPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => { setApplied(q.trim()); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const qs = new URLSearchParams({ type: tab, page: String(page), size: String(size), sort, dir, q: applied, lifecycle, leadStatus });
    fetch(`/api/hubspot?${qs}`, { signal: ctrl.signal, cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.success) throw new Error(j?.error || "Unable to load HubSpot data.");
        setData(j.data);
        setError("");
      })
      .catch((e: Error) => setError(e.name === "AbortError" ? "Loading HubSpot took too long." : e.message))
      .finally(() => { clearTimeout(timer); setLoading(false); });
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [tab, page, size, sort, dir, applied, lifecycle, leadStatus, tries]);

  const reload = useCallback(() => { setLoading(true); setTries((n) => n + 1); }, []);
  const cols = COLS[tab];
  const label = (field: string, v: string) => data?.options[field]?.find((o) => o.value === v)?.label ?? v;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const noun = tab === "contact" ? "contacts" : "companies";

  function reset(t: Tab) { setTab(t); setSort("createdate"); setDir("desc"); setPage(0); setLifecycle(""); setLeadStatus(""); setQ(""); setApplied(""); setData(null); setLoading(true); }
  function pick(s?: string) {
    if (!s) return;
    if (s === sort) setDir((d) => (d === "asc" ? "desc" : "asc")); else { setSort(s); setDir("asc"); }
    setPage(0); setLoading(true);
  }
  const go = (n: number) => { setPage(n); setLoading(true); };

  return (
    <div className="hs-wrap">
      <div className="hs-head">
        <select className="hs-title" aria-label="Object type" value={tab} onChange={(e) => reset(e.target.value as Tab)}>
          <option value="contact">Contacts</option>
          <option value="company">Companies</option>
        </select>
        <span className="spacer" />
        <span className="hint" role="status">{loading ? "Loading from HubSpot…" : "Live from HubSpot"}</span>
      </div>
      <div className="hs-tabs"><div className="hs-tab">All {noun}</div></div>

      <div className="hs-toolbar">
        <input className="hs-search" type="search" placeholder={`Search ${noun}`} value={q} onChange={(e) => { setQ(e.target.value); setLoading(true); }} aria-label={`Search ${noun}`} />
        <select className="hs-sel" aria-label="Lifecycle stage" value={lifecycle} onChange={(e) => { setLifecycle(e.target.value); setPage(0); setLoading(true); }}>
          <option value="">Lifecycle stage: any</option>
          {(data?.options.lifecyclestage ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="hs-sel" aria-label="Lead status" value={leadStatus} onChange={(e) => { setLeadStatus(e.target.value); setPage(0); setLoading(true); }}>
          <option value="">Lead status: any</option>
          {(data?.options.hs_lead_status ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="hs-sel" aria-label="Sort by" value={`${sort}|${dir}`} onChange={(e) => { const [s, d] = e.target.value.split("|"); setSort(s); setDir(d as "asc" | "desc"); setPage(0); setLoading(true); }}>
          {cols.filter((c) => c.sort).flatMap((c) => [
            <option key={`${c.sort}|asc`} value={`${c.sort}|asc`}>Sort: {c.label} (A→Z)</option>,
            <option key={`${c.sort}|desc`} value={`${c.sort}|desc`}>Sort: {c.label} (Z→A)</option>,
          ])}
        </select>
      </div>

      {error && <div style={{ padding: "0 22px 18px" }}><ErrorState message={`Unable to load HubSpot data. ${error}`} onRetry={reload} /></div>}
      {!error && (
        <>
          <div className="hs-table-wrap" style={{ opacity: loading && data ? 0.55 : 1 }}>
            <table className="hs-table">
              <thead><tr>{cols.map((c) => <th key={c.key}>{c.sort ? <button onClick={() => pick(c.sort)}>{c.label} {sort === c.sort ? (dir === "asc" ? "▲" : "▼") : ""}</button> : c.label}</th>)}</tr></thead>
              <tbody>
                {!data && <tr><td colSpan={cols.length} className="empty">Loading from HubSpot…</td></tr>}
                {data && data.records.length === 0 && <tr><td colSpan={cols.length} className="empty">No {noun} match these filters.</td></tr>}
                {data?.records.map((r) => (
                  <tr key={r.id}>
                    {cols.map((c, i) => {
                      const raw = r.properties[c.key] ?? "";
                      if (i === 0) {
                        const n = recordName(tab, r.properties);
                        return <td key={c.key}><div className="hs-name"><span className="hs-avatar" aria-hidden>{initials(n)}</span><Link className="hs-link" href={`/hubspot/${tab === "contact" ? "contacts" : "companies"}/${r.id}`}>{n}</Link></div></td>;
                      }
                      return (
                        <td key={c.key}>
                          {!raw ? "--" : c.kind === "enum" ? label(c.key, raw) : c.kind === "date" ? fmtDate(raw) : c.kind === "email" ? <a className="hs-link" href={`mailto:${raw}`}>{raw}</a> : raw}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="hs-foot">
            <span className="hs-count">{data ? `${fmtInt(data.total)} ${noun}` : "…"}</span>
            <nav className="hs-pager" aria-label="Pages">
              <button className="hs-pg" disabled={page === 0 || loading} onClick={() => go(page - 1)}>‹ Prev</button>
              {pageNumbers(page, pages).map((n) => <button key={n} className={`hs-pg${n === page ? " on" : ""}`} aria-current={n === page ? "page" : undefined} disabled={loading} onClick={() => go(n)}>{n + 1}</button>)}
              <button className="hs-pg" disabled={page >= pages - 1 || loading} onClick={() => go(page + 1)}>Next ›</button>
            </nav>
            <select className="hs-sel" aria-label="Per page" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); setLoading(true); }}>
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n} per page</option>)}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
