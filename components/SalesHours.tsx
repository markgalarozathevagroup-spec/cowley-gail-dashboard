"use client";

import { useMemo, useState } from "react";
import type { ClientRow, EntryRow, SalesHoursData, ServiceRow } from "@/lib/salesTypes";
import { fmtHours, fmtInt, fmtMoney } from "@/lib/formatters";
import { useApi } from "@/lib/useApi";
import ErrorState from "./ErrorState";
import Header from "./Header";
import LoadingState from "./LoadingState";

const TABS = [
  "Client Detail — Services & Pricing",
  "Service Pattern Analysis — What Cowley Offers",
  "Function Fox Hours",
  "Key Observations & Flags",
] as const;

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <p className="text-base font-semibold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold text-navy">{value}</p>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
    </div>
  );
}

export default function SalesHours() {
  const { state, retry } = useApi<SalesHoursData>("/api/sales-hours", "Sales & Hours");
  return (
    <>
      <Header title="Sales & Hours" subtitle="QuickBooks billing compared with FunctionFox tracked time" />
      {state.status === "loading" && <LoadingState label="Loading Sales & Hours…" cards={8} />}
      {state.status === "error" && <ErrorState message={`Unable to load Sales & Hours data. ${state.error}`} onRetry={retry} />}
      {state.status === "ready" && <Body data={state.data} />}
    </>
  );
}

function Body({ data }: { data: SalesHoursData }) {
  const [tab, setTab] = useState(0);
  const s = data.summary;
  return (
    <div className="space-y-8">
      <section aria-label="Executive summary">
        <h2 className="mb-3 text-2xl font-bold text-navy">Executive Summary</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Total Revenue Billed" value={fmtMoney(s.totalRevenueBilled)} note={`QuickBooks, ${data.qbPeriod}`} />
          <Card label="Tracked Fees" value={fmtMoney(s.trackedFees)} note="FunctionFox" />
          <Card label="External Client Hours" value={fmtHours(s.externalHours)} note={`of ${fmtHours(s.totalTrackedHours)} total (${fmtHours(s.internalHours)} internal)`} />
          <Card label="Revenue Gap" value={fmtMoney(s.revenueGap)} note="Billed minus tracked fees" />
          <Card label="Total Clients" value={fmtInt(s.totalClients)} />
          <Card label="Clients with Tracked Hours" value={fmtInt(s.clientsWithHours)} />
          <Card label="Standard Billing Rate" value={`$${s.standardRate}/hr`} />
          <Card label="Unbilled Tracked Work" value={fmtMoney(s.unbilledTrackedWork)} note="Tracked fees for clients with no QuickBooks billing" />
        </div>
      </section>

      <section>
        <div role="tablist" aria-label="Sales & Hours sections" className="flex flex-wrap gap-2">
          {TABS.map((t, i) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className={`rounded-lg border-2 px-4 py-3 text-base font-semibold ${tab === i ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-teal"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="mt-5">
          {tab === 0 && <ClientDetail rows={data.clients} />}
          {tab === 1 && <ServicePatterns rows={data.services} clientsWithHours={s.clientsWithHours} />}
          {tab === 2 && <FoxHours rows={data.entries} />}
          {tab === 3 && <Flags data={data} />}
        </div>
      </section>
    </div>
  );
}

/* ---------- sorting helpers ---------- */
type Dir = "asc" | "desc";
function useSort<T>(rows: T[], initialKey: keyof T, initialDir: Dir = "desc") {
  const [key, setKey] = useState<keyof T>(initialKey);
  const [dir, setDir] = useState<Dir>(initialDir);
  const sorted = useMemo(() => {
    const m = dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = a[key], bv = b[key];
      const av2 = Array.isArray(av) ? av.join(", ") : av;
      const bv2 = Array.isArray(bv) ? bv.join(", ") : bv;
      return (typeof av2 === "string" ? av2.localeCompare(bv2 as string) : (av2 as number) - (bv2 as number)) * m;
    });
  }, [rows, key, dir]);
  const toggle = (k: keyof T) => {
    if (k === key) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setKey(k); setDir(typeof rows[0]?.[k] === "string" ? "asc" : "desc"); }
  };
  return { sorted, key, dir, toggle };
}

function Th<T>({ label, k, sort, right, narrow }: { label: string; k: keyof T; sort: ReturnType<typeof useSort<T>>; right?: boolean; narrow?: boolean }) {
  const active = sort.key === k;
  return (
    <th className={`p-4 ${right ? "text-right" : ""} ${narrow ? "w-12" : ""}`} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button onClick={() => sort.toggle(k)} className="font-bold uppercase tracking-wide hover:text-navy">
        {label} {active ? (sort.dir === "asc" ? "▲" : "▼") : <span className="opacity-30">↕</span>}
      </button>
    </th>
  );
}

const tableWrap = "overflow-x-auto rounded-xl border border-line bg-white";
const thead = "bg-surface text-sm text-muted";

/* ---------- Tab 1 ---------- */
function ClientDetail({ rows }: { rows: ClientRow[] }) {
  const sort = useSort<ClientRow>(rows, "qbBilled");
  return (
    <div className={tableWrap}>
      <table className="w-full text-left text-base">
        <thead className={thead}>
          <tr>
            <th className="w-12 p-4">#</th>
            <Th<ClientRow> label="Client" k="name" sort={sort} />
            <Th<ClientRow> label="Services Rendered" k="services" sort={sort} />
            <Th<ClientRow> label="FF Hrs" k="ffHours" sort={sort} right />
            <Th<ClientRow> label="FF Fees" k="ffFees" sort={sort} right />
            <Th<ClientRow> label="QB Billed" k="qbBilled" sort={sort} right />
            <Th<ClientRow> label="Gap" k="gap" sort={sort} right />
          </tr>
        </thead>
        <tbody>
          {sort.sorted.map((c, i) => (
            <tr key={c.name} className="border-t border-line align-top">
              <td className="w-12 p-4 text-muted">{i + 1}</td>
              <td className="p-4 font-semibold">{c.name}</td>
              <td className="p-4">{c.services.length ? c.services.join(", ") : <span className="text-muted">No tracked work</span>}</td>
              <td className="p-4 text-right">{fmtHours(c.ffHours)}</td>
              <td className="p-4 text-right">{fmtMoney(c.ffFees)}</td>
              <td className="p-4 text-right">{fmtMoney(c.qbBilled)}</td>
              <td className={`p-4 text-right font-bold ${c.gap < 0 ? "text-bad" : "text-good"}`}>{c.gap > 0 ? "+" : ""}{fmtMoney(c.gap)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Tab 2 ---------- */
function ServicePatterns({ rows, clientsWithHours }: { rows: ServiceRow[]; clientsWithHours: number }) {
  return (
    <>
      <p className="mb-3 text-base text-muted">Based on {clientsWithHours} clients with tracked FunctionFox hours. Prevalence is the share of those clients receiving each service.</p>
      <div className={tableWrap}>
        <table className="w-full text-left text-base">
          <thead className={`${thead} text-sm uppercase tracking-wide`}>
            <tr>
              <th className="p-4">Service</th>
              <th className="p-4 text-right">Clients</th>
              <th className="p-4 w-64">Prevalence</th>
              <th className="p-4">Representative Clients</th>
              <th className="p-4">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.service} className="border-t border-line align-top">
                <td className="p-4 font-semibold">{r.service}</td>
                <td className="p-4 text-right">{r.clients}</td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-4 flex-1 rounded bg-line" role="img" aria-label={`${r.prevalence.toFixed(0)} percent`}>
                      <div className="h-4 rounded bg-teal" style={{ width: `${Math.min(100, r.prevalence)}%` }} />
                    </div>
                    <span className="w-12 text-right font-semibold">{r.prevalence.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="p-4">{r.representative.join(", ")}</td>
                <td className="p-4 text-muted">{fmtHours(r.hours)} hrs · {fmtMoney(r.fees)} tracked</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- Tab 3 ---------- */
function FoxHours({ rows }: { rows: EntryRow[] }) {
  const sort = useSort<EntryRow>(rows, "fees");
  return (
    <div className={tableWrap}>
      <table className="w-full text-left text-base">
        <thead className={thead}>
          <tr>
            <Th<EntryRow> label="Client" k="client" sort={sort} />
            <Th<EntryRow> label="Project" k="project" sort={sort} />
            <Th<EntryRow> label="Category" k="category" sort={sort} />
            <Th<EntryRow> label="Personnel" k="personnel" sort={sort} />
            <Th<EntryRow> label="Rate" k="rate" sort={sort} right />
            <Th<EntryRow> label="Hours" k="hours" sort={sort} right />
            <Th<EntryRow> label="Fees" k="fees" sort={sort} right />
          </tr>
        </thead>
        <tbody>
          {sort.sorted.map((e, i) => (
            <tr key={i} className="border-t border-line">
              <td className="p-4 font-semibold">{e.client}</td>
              <td className="p-4">{e.project}</td>
              <td className="p-4">{e.category}</td>
              <td className="p-4">{e.personnel}</td>
              <td className="p-4 text-right">{fmtMoney(e.rate)}</td>
              <td className="p-4 text-right">{fmtHours(e.hours)}</td>
              <td className="p-4 text-right">{fmtMoney(e.fees)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Tab 4 ---------- */
function Flags({ data }: { data: SalesHoursData }) {
  const cls = { danger: "border-bad", warning: "border-warning", info: "border-teal" } as const;
  return (
    <div className="space-y-4">
      {data.flags.length === 0 && <p className="text-lg text-muted">No observations to report.</p>}
      {data.flags.map((f) => (
        <div key={f.title} className={`rounded-xl border-2 border-l-8 bg-white p-5 ${cls[f.severity]}`}>
          <h3 className="text-lg font-bold text-navy">{f.title}</h3>
          <p className="mt-1 text-base">{f.detail}</p>
        </div>
      ))}
      <p className="text-sm text-muted">
        Calculated from the live sheets. {data.excludedRows.qbTotals + data.excludedRows.ffTotals} TOTAL/SUBTOTAL rows were excluded from all calculations.
      </p>
    </div>
  );
}
