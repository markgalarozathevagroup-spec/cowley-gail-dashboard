"use client";

import { useMemo, useState } from "react";
import type { Campaign, MailchimpData } from "@/app/api/mailchimp/route";
import { BENCHMARKS, EXCLUDED_CAMPAIGN_WORDS } from "@/lib/constants";
import { fmtDate, fmtInt, fmtPct, MONTHS } from "@/lib/formatters";
import { useApi } from "@/lib/useApi";
import ErrorState from "./ErrorState";
import Header from "./Header";
import LoadingState from "./LoadingState";

type SortKey = "date" | "name" | "emailsSent" | "openRate" | "clickRate" | "uniqueOpens" | "clicks";
type Dir = "desc" | "asc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "name", label: "Campaign Name" },
  { key: "emailsSent", label: "Emails Sent" },
  { key: "openRate", label: "Open Rate" },
  { key: "clickRate", label: "Click Rate" },
  { key: "uniqueOpens", label: "Unique Opens" },
  { key: "clicks", label: "Clicks" },
];

const isExcluded = (name: string) => {
  const n = name.toLowerCase();
  return EXCLUDED_CAMPAIGN_WORDS.some((w) => n.includes(w));
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <p className="text-base font-semibold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold text-navy">{value}</p>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
    </div>
  );
}

const selectCls = "rounded-lg border-2 border-line bg-white px-3 py-2.5 text-base text-ink";

function Delta({ value, base }: { value: number; base: number }) {
  const d = value - base;
  const up = d >= 0;
  return (
    <span className={`block text-sm font-semibold ${up ? "text-good" : "text-bad"}`}>
      {up ? "▲ +" : "▼ "}
      {d.toFixed(2)} pts vs All Users
    </span>
  );
}

export default function Mailchimp() {
  const { state, retry } = useApi<MailchimpData>("/api/mailchimp", "Mailchimp");

  return (
    <>
      <Header title="Mailchimp" subtitle="Email newsletter audience and campaign performance" />
      {state.status === "loading" && <LoadingState label="Loading Mailchimp…" />}
      {state.status === "error" && (
        <ErrorState message={`Unable to load Mailchimp data. ${state.error}`} onRetry={retry} />
      )}
      {state.status === "ready" && <Body data={state.data} />}
    </>
  );
}

function Body({ data }: { data: MailchimpData }) {
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [dir, setDir] = useState<Dir>("desc");

  const years = useMemo(
    () => [...new Set(data.campaigns.map((c) => c.date.slice(0, 4)))].sort().reverse(),
    [data.campaigns],
  );

  const filtered = useMemo(
    () =>
      data.campaigns.filter(
        (c) => (!year || c.date.slice(0, 4) === year) && (!month || c.date.slice(5, 7) === month),
      ),
    [data.campaigns, year, month],
  );

  const sorted = useMemo(() => {
    const m = dir === "desc" ? -1 : 1;
    return [...filtered].sort((a: Campaign, b: Campaign) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const r = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return r * m;
    });
  }, [filtered, sortKey, dir]);

  const periodOpen = avg(filtered.map((c) => c.openRate));
  const periodClick = avg(filtered.map((c) => c.clickRate));
  const best = useMemo(
    () => filtered.filter((c) => !isExcluded(c.name)).sort((a, b) => b.openRate - a.openRate)[0],
    [filtered],
  );
  const filterActive = Boolean(year || month);
  const periodLabel = filterActive
    ? `${month ? MONTHS[Number(month) - 1] : "All months"} ${year || "(all years)"}`
    : "All time";
  const allUsers = BENCHMARKS.find((b) => b.industry === "All Users")!;

  return (
    <div className="space-y-8">
      <section aria-label="Audience">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Subscribers" value={fmtInt(data.subscribers)} note={data.audience} />
          <Card label="Unsubscribes (all-time)" value={fmtInt(data.unsubscribes)} />
          <Card label="Cleaned Contacts" value={fmtInt(data.cleaned)} />
          <Card label="Campaigns Sent" value={fmtInt(data.campaignsSent)} note={data.lastCampaign ? `Last sent ${fmtDate(data.lastCampaign)}` : undefined} />
          <Card label="Avg Open Rate" value={fmtPct(data.avgOpenRate)} note="All campaigns" />
          <Card label="Avg Click Rate" value={fmtPct(data.avgClickRate)} note="All campaigns" />
          <Card label="Tracking Since" value={fmtDate(data.trackingSince)} note="Audience created" />
          <Card
            label="Best Campaign (selected period)"
            value={best ? fmtPct(best.openRate) : "—"}
            note={best ? best.name : "No campaigns in this period"}
          />
        </div>
      </section>

      <section aria-label="Filters" className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-base font-semibold">
            Year
            <select className={`${selectCls} mt-1 block`} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All years</option>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
          <label className="text-base font-semibold">
            Month
            <select className={`${selectCls} mt-1 block`} value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">All months</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() => { setYear(""); setMonth(""); }}
            className="rounded-lg border-2 border-navy px-5 py-2.5 text-base font-semibold text-navy hover:bg-surface"
          >
            Reset
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Card label={`Campaigns — ${periodLabel}`} value={fmtInt(filtered.length)} />
          <Card label="Avg Open Rate — selected period" value={filtered.length ? fmtPct(periodOpen) : "—"} />
          <Card label="Avg Click Rate — selected period" value={filtered.length ? fmtPct(periodClick) : "—"} />
        </div>
      </section>

      <section aria-label="Recent campaigns">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-bold text-navy">Recent Campaigns</h2>
          <div className="flex flex-wrap gap-3">
            <label className="text-base font-semibold">
              Sort by
              <select className={`${selectCls} ml-2`} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <label className="text-base font-semibold">
              Order
              <select className={`${selectCls} ml-2`} value={dir} onChange={(e) => setDir(e.target.value as Dir)}>
                <option value="desc">{sortKey === "date" ? "Newest first" : "Highest first"}</option>
                <option value="asc">{sortKey === "date" ? "Oldest first" : "Lowest first"}</option>
              </select>
            </label>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-base">
            <thead className="bg-surface text-sm uppercase tracking-wide text-muted">
              <tr>
                <th className="p-4">Campaign</th>
                <th className="p-4">Date</th>
                <th className="p-4 text-right">Emails Sent</th>
                <th className="p-4 text-right">Open Rate</th>
                <th className="p-4 text-right">Click Rate</th>
                <th className="p-4 text-right">Unique Opens</th>
                <th className="p-4 text-right">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-muted">No campaigns in the selected period.</td></tr>
              )}
              {sorted.map((c, i) => (
                <tr key={`${c.name}-${c.date}-${i}`} className="border-t border-line">
                  <td className="p-4 font-semibold">{c.name}</td>
                  <td className="p-4 whitespace-nowrap">{fmtDate(c.date)}</td>
                  <td className="p-4 text-right">{fmtInt(c.emailsSent)}</td>
                  <td className="p-4 text-right">{fmtPct(c.openRate)}</td>
                  <td className="p-4 text-right">{fmtPct(c.clickRate)}</td>
                  <td className="p-4 text-right">{fmtInt(c.uniqueOpens)}</td>
                  <td className="p-4 text-right">{fmtInt(c.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Industry comparison">
        <h2 className="mb-3 text-2xl font-bold text-navy">Industry Performance Comparison</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-base">
            <thead className="bg-surface text-sm uppercase tracking-wide text-muted">
              <tr>
                <th className="p-4">Industry</th>
                <th className="p-4 text-right">Avg. Open Rate</th>
                <th className="p-4 text-right">Avg. Click Rate</th>
                <th className="p-4 text-right">Unsubscription Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line bg-surface/60">
                <td className="p-4 font-bold">
                  Cowley — {periodLabel}
                  <span className="block text-sm font-normal text-muted">From your Mailchimp campaigns</span>
                </td>
                <td className="p-4 text-right font-bold">
                  {filtered.length ? fmtPct(periodOpen) : "—"}
                  {filtered.length > 0 && <Delta value={periodOpen} base={allUsers.open} />}
                </td>
                <td className="p-4 text-right font-bold">
                  {filtered.length ? fmtPct(periodClick) : "—"}
                  {filtered.length > 0 && <Delta value={periodClick} base={allUsers.click} />}
                </td>
                <td className="p-4 text-right text-muted">Not tracked per campaign</td>
              </tr>
              {BENCHMARKS.map((b) => (
                <tr key={b.industry} className="border-t border-line">
                  <td className="p-4 font-semibold">
                    {b.industry}
                    <span className="block text-sm font-normal text-muted">{b.label}</span>
                  </td>
                  <td className="p-4 text-right">{fmtPct(b.open)}</td>
                  <td className="p-4 text-right">{fmtPct(b.click)}</td>
                  <td className="p-4 text-right">{fmtPct(b.unsub)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
