"use client";

import { useCallback, useEffect, useState } from "react";
import type { HubspotPage, HubspotRecord } from "@/app/api/hubspot/route";
import { fmtInt } from "@/lib/formatters";
import { sendJson } from "@/lib/sendJson";
import ErrorState from "./ErrorState";

type Tab = "company" | "contact";
type Col = { key: string; label: string; edit?: "text" | "enum"; sort?: string };

const COLS: Record<Tab, Col[]> = {
  company: [
    { key: "name", label: "Company", sort: "name" },
    { key: "hs_lead_status", label: "Lead Status", edit: "enum", sort: "hs_lead_status" },
    { key: "lifecyclestage", label: "Lifecycle", edit: "enum", sort: "lifecyclestage" },
    { key: "project_status", label: "Project Status", edit: "enum", sort: "project_status" },
    { key: "industry", label: "Industry", edit: "enum", sort: "industry" },
    { key: "city", label: "City", edit: "text", sort: "city" },
    { key: "state", label: "State", edit: "text", sort: "state" },
    { key: "dashboard_approval_status", label: "Dashboard Approval" },
  ],
  contact: [
    { key: "name", label: "Name", sort: "lastname" },
    { key: "jobtitle", label: "Title", edit: "text", sort: "jobtitle" },
    { key: "company", label: "Company", edit: "text", sort: "company" },
    { key: "city", label: "City", sort: "city" },
    { key: "lifecyclestage", label: "Lifecycle", edit: "enum", sort: "lifecyclestage" },
    { key: "email", label: "Email", sort: "email" },
  ],
};

const display = (r: HubspotRecord, key: string) => {
  const p = r.properties;
  if (key === "name") return "firstname" in p || "lastname" in p ? [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "" : p.name || p.domain || "";
  return p[key] ?? "";
};

export default function Hubspot() {
  const [tab, setTab] = useState<Tab>("company");
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [sort, setSort] = useState("createdate");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<HubspotPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tries, setTries] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ companies: number; contacts: number } | null>(null);

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => { setApplied(q.trim()); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    fetch("/api/hubspot?summary=1").then((r) => r.json()).then((j) => j?.success && setCounts(j.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const qs = new URLSearchParams({ type: tab, page: String(page), sort, dir, q: applied });
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
  }, [tab, page, sort, dir, applied, tries]);

  const reload = useCallback(() => { setLoading(true); setTries((n) => n + 1); }, []);
  const cols = COLS[tab];
  const label = (field: string, v: string) => data?.options[field]?.find((o) => o.value === v)?.label ?? v;

  function switchTab(t: Tab) { setTab(t); setSort("createdate"); setDir("desc"); setPage(0); setEditing(null); setLoading(true); setData(null); }
  function pick(s?: string) {
    if (!s) return;
    if (s === sort) setDir((d) => (d === "asc" ? "desc" : "asc")); else { setSort(s); setDir("asc"); }
    setPage(0); setLoading(true);
  }
  function applyChange(id: string, props: Record<string, string>) {
    setData((d) => d && { ...d, records: d.records.map((x) => (x.id === id ? { ...x, properties: { ...x.properties, ...props } } : x)) });
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <div className="filters">
        <span className="slab">Live from HubSpot</span>
        <input className="search" type="search" placeholder="Search HubSpot…" value={q} onChange={(e) => { setQ(e.target.value); setLoading(true); }} aria-label="Search HubSpot" />
        <button className={`hubtab${tab === "company" ? " on" : ""}`} onClick={() => switchTab("company")}>Companies{counts ? ` (${fmtInt(counts.companies)})` : ""}</button>
        <button className={`hubtab${tab === "contact" ? " on" : ""}`} onClick={() => switchTab("contact")}>Contacts{counts ? ` (${fmtInt(counts.contacts)})` : ""}</button>
        <span className="hint" style={{ marginLeft: "auto" }}>Edits save straight to HubSpot</span>
      </div>

      <div className="sec-h" style={{ marginTop: 0 }}>
        <h2>{tab === "company" ? "Companies" : "Contacts"}</h2>
        <span className="hint" role="status">{loading ? "Loading from HubSpot…" : data ? `${fmtInt(data.total)} ${applied ? "matching" : "records"}` : ""}</span>
      </div>
      {error && <ErrorState message={`Unable to load HubSpot data. ${error}`} onRetry={reload} />}
      {!error && (
        <>
          <div className="panel" style={{ overflow: "auto", opacity: loading && data ? 0.55 : 1 }}>
            <table className="stable">
              <thead><tr>{cols.map((c) => <th key={c.key}>{c.sort ? <button onClick={() => pick(c.sort)}>{c.label} {sort === c.sort ? (dir === "asc" ? "▲" : "▼") : ""}</button> : c.label}</th>)}<th><span className="sr-only">Edit</span></th></tr></thead>
              <tbody>
                {!data && <tr><td colSpan={cols.length + 1} className="empty">Loading from HubSpot…</td></tr>}
                {data && data.records.length === 0 && <tr><td colSpan={cols.length + 1} className="empty">Nothing found.</td></tr>}
                {data?.records.map((r) =>
                  editing === r.id ? (
                    <EditRow key={r.id} r={r} type={tab} cols={cols} options={data.options} onDone={(p) => { if (p) applyChange(r.id, p); setEditing(null); }} />
                  ) : (
                    <tr key={r.id}>
                      {cols.map((c, i) => {
                        const v = display(r, c.key);
                        return (
                          <td key={c.key} className={i === 0 ? "snm" : "subj"}>
                            {i === 0 ? <a href={`${data.recordUrl}${r.id}`} target="_blank" rel="noopener noreferrer">{v || "—"}</a>
                              : c.key === "email" && v ? <a href={`mailto:${v}`}>{v}</a>
                              : c.key === "dashboard_approval_status" ? (v ? <span className={`badge ${v === "approved" ? "b-green" : "b-red"}`}>{v === "approved" ? "Approved" : "Not Approved"}</span> : "—")
                              : v ? (c.edit === "enum" ? label(c.key, v) : v) : "—"}
                          </td>
                        );
                      })}
                      <td><button className="mini-btn" style={{ marginTop: 0 }} onClick={() => setEditing(r.id)}>Edit</button></td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", marginTop: 14 }}>
            <button className="sel-btn" disabled={page === 0 || loading} onClick={() => { setPage(page - 1); setLoading(true); }}>← Previous</button>
            <span className="hint">Page {page + 1} of {pages}</span>
            <button className="sel-btn" disabled={page >= pages - 1 || loading} onClick={() => { setPage(page + 1); setLoading(true); }}>Next →</button>
          </div>
        </>
      )}
    </>
  );
}

function EditRow({ r, type, cols, options, onDone }: {
  r: HubspotRecord; type: Tab; cols: Col[]; options: HubspotPage["options"]; onDone: (changed: Record<string, string> | null) => void;
}) {
  const editable = cols.filter((c) => c.edit);
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(editable.map((c) => [c.key, r.properties[c.key] ?? ""])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    const changed = Object.fromEntries(Object.entries(draft).filter(([k, v]) => v !== (r.properties[k] ?? "")));
    if (!Object.keys(changed).length) return onDone(null);
    setBusy(true);
    setErr("");
    const saved: Record<string, string> = {};
    try {
      for (const [field, value] of Object.entries(changed)) {
        await sendJson("/api/hubspot", "PATCH", { type, id: r.id, field, value });
        saved[field] = value;
      }
      onDone(saved);
    } catch (e) {
      setErr((e as Error).message);
      if (Object.keys(saved).length) onDone(saved);
      setBusy(false);
    }
  }

  return (
    <tr style={{ background: "var(--brand-lt)" }}>
      {cols.map((c, i) => (
        <td key={c.key}>
          {!c.edit ? <span className={i === 0 ? "snm" : "subj"}>{display(r, c.key) || "—"}</span>
            : c.edit === "enum" ? (
              <select className="status-sel" style={{ minWidth: 110 }} aria-label={c.label} value={draft[c.key]} onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}>
                <option value="">—</option>
                {(options[c.key] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : <input className="doc-input" aria-label={c.label} value={draft[c.key]} maxLength={200} onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })} />}
        </td>
      ))}
      <td style={{ whiteSpace: "nowrap" }}>
        <button className="btn" style={{ padding: "6px 12px" }} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save to HubSpot"}</button>{" "}
        <button className="sel-btn" disabled={busy} onClick={() => onDone(null)}>Cancel</button>
        {err && <div role="alert" className="save-msg err" style={{ whiteSpace: "normal", maxWidth: 220 }}>{err}</div>}
      </td>
    </tr>
  );
}
