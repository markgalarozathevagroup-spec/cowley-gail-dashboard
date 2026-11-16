"use client";

import { useMemo, useState } from "react";
import type { HubspotData } from "@/app/api/hubspot/route";
import { fmtInt } from "@/lib/formatters";
import { useApi } from "@/lib/useApi";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

export default function Hubspot() {
  const { state, retry } = useApi<HubspotData>("/api/hubspot", "Hubspot");
  if (state.status === "loading") return <LoadingState label="Loading Hubspot…" cards={2} />;
  if (state.status === "error") return <ErrorState message={`Unable to load Hubspot data. ${state.error}`} onRetry={retry} />;
  return <Body data={state.data} />;
}

function Body({ data }: { data: HubspotData }) {
  const [tab, setTab] = useState<"contacts" | "companies">("companies");
  const [q, setQ] = useState("");
  const [key, setKey] = useState("name");
  const [dir, setDir] = useState<1 | -1>(1);
  const needle = q.toLowerCase();

  const rows = useMemo(() => {
    const src = (tab === "contacts" ? data.contactList : data.companyList) as unknown as Record<string, string>[];
    return src
      .filter((r) => !needle || Object.values(r).some((v) => String(v).toLowerCase().includes(needle)))
      .sort((a, b) => String(a[key] ?? "").toLowerCase().localeCompare(String(b[key] ?? "").toLowerCase()) * dir);
  }, [data, tab, needle, key, dir]);

  const cols: [string, string][] =
    tab === "contacts"
      ? [["name", "Name"], ["title", "Title"], ["company", "Company"], ["city", "City"], ["stage", "Lifecycle Stage"], ["email", "Email"]]
      : [["name", "Company"], ["projectStatus", "Project Status"], ["leadStatus", "Lead Status"], ["lifecycle", "Lifecycle"], ["city", "City"], ["state", "State"], ["industry", "Industry"]];

  function pick(k: string) {
    if (k === key) setDir((d) => (d === 1 ? -1 : 1));
    else { setKey(k); setDir(1); }
  }
  function switchTab(t: "contacts" | "companies") { setTab(t); setKey("name"); setDir(1); }

  return (
    <>
      <div className="filters">
        <span className="slab">Search companies &amp; contacts</span>
        <input className="search" type="search" placeholder="Type to filter…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <button className={`hubtab${tab === "contacts" ? " on" : ""}`} onClick={() => switchTab("contacts")}>Contacts ({fmtInt(data.contacts)})</button>
        <button className={`hubtab${tab === "companies" ? " on" : ""}`} onClick={() => switchTab("companies")}>Companies ({fmtInt(data.companies)})</button>
      </div>
      <div className="sec-h" style={{ marginTop: 0 }}><h2>{tab === "contacts" ? "Contacts" : "Companies"}</h2><span className="hint">{fmtInt(rows.length)} {tab}</span></div>
      <div className="panel" style={{ overflow: "auto" }}>
        <table className="stable">
          <thead><tr>{cols.map(([k, l]) => <th key={k}><button onClick={() => pick(k)}>{l} {key === k ? (dir === 1 ? "▲" : "▼") : ""}</button></th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length} className="empty">No {tab} found.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.map(([k], ci) => (
                  <td key={k} className={ci === 0 ? "snm" : "subj"}>
                    {k === "lifecycle" || k === "stage" ? <span className="badge b-gray">{r[k]}</span> : k === "email" && r[k] ? <a href={`mailto:${r[k]}`}>{r[k]}</a> : r[k] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
