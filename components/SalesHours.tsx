"use client";

import { useMemo, useState } from "react";
import type { ClientRow, EntryRow, SalesHoursData, ServiceRow } from "@/lib/salesTypes";
import { fmtHours, fmtInt, fmtMoney } from "@/lib/formatters";
import { useApi } from "@/lib/useApi";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

const TABS = [
  "Client Detail — Services & Pricing",
  "Service Pattern Analysis — What Cowley Offers",
  "Function Fox Hours",
  "Key Observations & Flags",
] as const;

const svcClass = (s: string) => {
  const v = s.toLowerCase();
  if (/web/.test(v)) return "web";
  if (/social/.test(v)) return "social";
  if (/media|pr/.test(v)) return "media";
  if (/advert/.test(v)) return "ad";
  if (/account/.test(v)) return "account";
  if (/video/.test(v)) return "video";
  if (/brand/.test(v)) return "brand";
  if (/collateral/.test(v)) return "collateral";
  if (/event/.test(v)) return "event";
  return "";
};

export default function SalesHours() {
  const { state, retry } = useApi<SalesHoursData>("/api/sales-hours", "Sales & Hours");
  if (state.status === "loading") return <LoadingState label="Loading Sales & Hours…" cards={8} />;
  if (state.status === "error") return <ErrorState message={`Unable to load Sales & Hours data. ${state.error}`} onRetry={retry} />;
  return <Body data={state.data} />;
}

type Dir = "asc" | "desc";
function useSort<T>(rows: T[], initialKey: keyof T, initialDir: Dir = "desc") {
  const [key, setKey] = useState<keyof T>(initialKey);
  const [dir, setDir] = useState<Dir>(initialDir);
  const sorted = useMemo(() => {
    const m = dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = a[key], bv = b[key];
      const x = Array.isArray(av) ? av.join(", ") : av;
      const y = Array.isArray(bv) ? bv.join(", ") : bv;
      return (typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number)) * m;
    });
  }, [rows, key, dir]);
  const toggle = (k: keyof T) => {
    if (k === key) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setKey(k); setDir(typeof rows[0]?.[k] === "string" ? "asc" : "desc"); }
  };
  return { sorted, key, dir, toggle };
}

function Th<T>({ label, k, sort, right }: { label: string; k: keyof T; sort: ReturnType<typeof useSort<T>>; right?: boolean }) {
  const on = sort.key === k;
  return (
    <th className={right ? "num" : ""} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button onClick={() => sort.toggle(k)}>{label} {on ? (sort.dir === "asc" ? "▲" : "▼") : <span style={{ opacity: 0.4 }}>↕</span>}</button>
    </th>
  );
}

function Body({ data }: { data: SalesHoursData }) {
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState("");
  const s = data.summary;
  const cards: [string, string, string, string][] = [
    ["", "Total Revenue Billed", fmtMoney(s.totalRevenueBilled), `QuickBooks, ${data.qbPeriod}`],
    ["navy", "Tracked Fees", fmtMoney(s.trackedFees), "FunctionFox"],
    ["", "External Client Hours", fmtHours(s.externalHours), `of ${fmtHours(s.totalTrackedHours)} total (${fmtHours(s.internalHours)} internal)`],
    ["warn", "Revenue Gap", fmtMoney(s.revenueGap), "Billed minus tracked fees"],
    ["", "Total Clients", fmtInt(s.totalClients), "QuickBooks and FunctionFox"],
    ["", "Clients with Tracked Hours", fmtInt(s.clientsWithHours), "Active in FunctionFox"],
    ["navy", "Standard Billing Rate", `$${s.standardRate}/hr`, ""],
    ["warn", "Unbilled Tracked Work", fmtMoney(s.unbilledTrackedWork), "Tracked fees with no QuickBooks billing"],
  ];
  return (
    <>
      <div className="exec-title">Executive Summary</div>
      <div className="grid4" style={{ marginTop: 0 }}>
        {cards.map(([c, l, v, sub]) => (
          <div key={l} className={`exec-card ${c}`}><div className="exec-lbl">{l}</div><div className="exec-val">{v}</div><div className="exec-sub">{sub}</div></div>
        ))}
      </div>

      <div className="date-box">
        <span style={{ fontWeight: 800, fontSize: 12 }}>Reporting Period</span>
        <span className="hint">{data.qbPeriod}</span>
        <span className="hint" style={{ marginLeft: "auto" }}>Month filtering needs date-level rows; the source tabs are period summaries.</span>
      </div>

      <div className="tabs" role="tablist" aria-label="Sales & Hours sections">
        {TABS.map((t, i) => (
          <button key={t} role="tab" aria-selected={tab === i} className={`tab${tab === i ? " active" : ""}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>
      {tab !== 3 && tab !== 1 && (
        <div style={{ marginBottom: 10 }}>
          <input className="search" type="search" placeholder={tab === 0 ? "Search clients…" : "Search entries…"} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        </div>
      )}
      <div role="tabpanel">
        {tab === 0 && <ClientDetail rows={data.clients} q={q} />}
        {tab === 1 && <ServicePatterns rows={data.services} n={s.clientsWithHours} />}
        {tab === 2 && <FoxHours rows={data.entries} q={q} />}
        {tab === 3 && <Flags data={data} />}
      </div>
    </>
  );
}

function ClientDetail({ rows, q }: { rows: ClientRow[]; q: string }) {
  const filtered = useMemo(() => rows.filter((r) => !q || (r.name + r.services.join(" ")).toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const sort = useSort<ClientRow>(filtered, "qbBilled");
  return (
    <>
      <div className="sec-h" style={{ marginTop: 0 }}><h2>Client Detail — Services &amp; Pricing <span style={{ fontWeight: 500 }}>(Sorted by Revenue)</span></h2></div>
      <p className="hint" style={{ margin: "0 2px 9px" }}>FF Fees = FunctionFox tracked fees | QB Billed = Sales by Customer Summary revenue | Gap = QB Billed minus FF Fees (positive = QB higher, negative = FF higher / possible unbilled work)</p>
      <div className="panel detail">
        <table className="stable detail-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>#</th>
              <Th<ClientRow> label="Client" k="name" sort={sort} />
              <Th<ClientRow> label="Services Rendered" k="services" sort={sort} />
              <Th<ClientRow> label="FF Hrs" k="ffHours" sort={sort} right />
              <Th<ClientRow> label="FF Fees" k="ffFees" sort={sort} right />
              <Th<ClientRow> label="QB Billed" k="qbBilled" sort={sort} right />
              <Th<ClientRow> label="Gap" k="gap" sort={sort} right />
            </tr>
          </thead>
          <tbody>
            {sort.sorted.length === 0 && <tr><td colSpan={7} className="empty">No results.</td></tr>}
            {sort.sorted.map((c, i) => (
              <tr key={c.name} className={c.qbBilled <= 0 && c.ffFees > 0 ? "unbilled" : ""}>
                <td className="subj">{i + 1}</td>
                <td>{c.name}</td>
                <td><div className="svc-wrap">{c.services.length ? c.services.map((x) => <span key={x} className={`svc ${svcClass(x)}`}>{x}</span>) : <span className="no-hours">No hours tracked</span>}</div></td>
                <td className="num">{fmtHours(c.ffHours)}</td>
                <td className="num">{fmtMoney(c.ffFees)}</td>
                <td className="num">{fmtMoney(c.qbBilled)}</td>
                <td className={`num ${c.gap < 0 ? "gap-neg" : "gap-pos"}`}>{c.gap > 0 ? "+" : ""}{fmtMoney(c.gap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ServicePatterns({ rows, n }: { rows: ServiceRow[]; n: number }) {
  const max = Math.max(1, ...rows.map((r) => r.clients));
  return (
    <>
      <div className="sec-h" style={{ marginTop: 0 }}><h2>Service Pattern Analysis — What Cowley Offers</h2></div>
      <p className="hint" style={{ marginBottom: 10 }}>Services ranked by number of clients receiving them, calculated from the live FunctionFox sheet ({n} clients with tracked hours). Prevalence = share of those clients.</p>
      <div className="panel detail">
        <table className="sp-table">
          <thead><tr><th>Service</th><th>Clients</th><th>Prevalence</th><th>Representative Clients</th><th>Notes</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.service}>
                <td>{r.service}</td><td>{r.clients}</td>
                <td><div className="prev"><div className="prev-track" role="img" aria-label={`${r.prevalence.toFixed(0)} percent`}><div className="prev-fill" style={{ width: `${(r.clients / max) * 100}%` }} /></div><b style={{ width: 40, textAlign: "right" }}>{r.prevalence.toFixed(0)}%</b></div></td>
                <td className="subj">{r.representative.join(", ")}</td>
                <td className="hint">{fmtHours(r.hours)} hrs · {fmtMoney(r.fees)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FoxHours({ rows, q }: { rows: EntryRow[]; q: string }) {
  const filtered = useMemo(() => rows.filter((r) => !q || `${r.client} ${r.project} ${r.personnel}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const sort = useSort<EntryRow>(filtered, "hours");
  const tot = filtered.reduce((a, r) => ({ h: a.h + r.hours, f: a.f + r.fees }), { h: 0, f: 0 });
  return (
    <>
      <div className="sec-h" style={{ marginTop: 0 }}><h2>Function Fox Hours</h2><span className="hint">{fmtHours(tot.h)} hrs · {fmtMoney(tot.f)} total fees</span></div>
      <div className="panel" style={{ overflow: "auto" }}>
        <table className="stable">
          <thead><tr>
            <Th<EntryRow> label="Client" k="client" sort={sort} /><Th<EntryRow> label="Project" k="project" sort={sort} /><Th<EntryRow> label="Category" k="category" sort={sort} />
            <Th<EntryRow> label="Personnel" k="personnel" sort={sort} /><Th<EntryRow> label="Rate" k="rate" sort={sort} right /><Th<EntryRow> label="Hours" k="hours" sort={sort} right /><Th<EntryRow> label="Fees" k="fees" sort={sort} right />
          </tr></thead>
          <tbody>
            {sort.sorted.length === 0 && <tr><td colSpan={7} className="empty">No results.</td></tr>}
            {sort.sorted.map((e, i) => (
              <tr key={i}><td className="snm">{e.client}</td><td className="subj">{e.project}</td><td className="subj">{e.category}</td><td className="subj">{e.personnel}</td><td className="num">{fmtMoney(e.rate)}</td><td className="num">{fmtHours(e.hours)}</td><td className="num">{fmtMoney(e.fees)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Flags({ data }: { data: SalesHoursData }) {
  return (
    <>
      <div className="sec-h" style={{ marginTop: 0 }}><h2>Key Observations &amp; Flags</h2></div>
      <div className="flags">
        <div className="flags-title">⚠ Items Requiring Attention</div>
        {data.flags.length === 0 && <p className="hint">No observations to report.</p>}
        {data.flags.map((f) => (
          <div key={f.title} className="flag-item"><strong>{f.title}:</strong> {f.detail}</div>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 10 }}>Calculated from the live sheets. {data.excludedRows.qbTotals + data.excludedRows.ffTotals} TOTAL/SUBTOTAL rows were excluded from all calculations.</p>
    </>
  );
}
