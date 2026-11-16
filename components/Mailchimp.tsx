"use client";

import { useMemo, useState } from "react";
import type { Campaign, MailchimpData } from "@/app/api/mailchimp/route";
import { BENCHMARKS } from "@/lib/constants";
import { fmtDate, fmtInt, fmtPct, MONTHS } from "@/lib/formatters";
import { useApi } from "@/lib/useApi";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

type SortKey = "date" | "name" | "emailsSent" | "openRate" | "clickRate" | "uniqueOpens" | "clicks";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "name", label: "Campaign Name" },
  { key: "emailsSent", label: "Emails Sent" },
  { key: "openRate", label: "Open Rate" },
  { key: "clickRate", label: "Click Rate" },
  { key: "uniqueOpens", label: "Unique Opens" },
  { key: "clicks", label: "Clicks" },
];

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pillCls = (n: number) => (n >= 3.5 ? "good" : n >= 1 ? "ok" : "low");

export default function Mailchimp() {
  const { state, retry } = useApi<MailchimpData>("/api/mailchimp", "Mailchimp");
  if (state.status === "loading") return <LoadingState label="Loading Mailchimp…" />;
  if (state.status === "error") return <ErrorState message={`Unable to load Mailchimp data. ${state.error}`} onRetry={retry} />;
  return <Body data={state.data} />;
}

function Delta({ value, base }: { value: number; base: number }) {
  const d = value - base;
  return <span className={`delta ${d >= 0 ? "up" : "down"}`}>{d >= 0 ? "▲ +" : "▼ "}{d.toFixed(2)} pts vs All Users</span>;
}

function Body({ data }: { data: MailchimpData }) {
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [dir, setDir] = useState<"desc" | "asc">("desc");

  const years = useMemo(() => [...new Set(data.campaigns.map((c) => c.date.slice(0, 4)))].sort().reverse(), [data.campaigns]);
  const filtered = useMemo(
    () => data.campaigns.filter((c) => (!year || c.date.slice(0, 4) === year) && (!month || c.date.slice(5, 7) === month)),
    [data.campaigns, year, month],
  );
  const shown = useMemo(() => {
    const m = dir === "desc" ? -1 : 1;
    return filtered
      .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a: Campaign, b: Campaign) => {
        const av = a[sortKey], bv = b[sortKey];
        return (typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * m;
      });
  }, [filtered, q, sortKey, dir]);

  const active = Boolean(year || month);
  const openRate = active ? avg(filtered.map((c) => c.openRate)) : data.avgOpenRate;
  const clickRate = active ? avg(filtered.map((c) => c.clickRate)) : data.avgClickRate;
  const periodLabel = active ? `${month ? MONTHS[Number(month) - 1] : "All months"} ${year || ""}`.trim() : "";
  const all = BENCHMARKS.find((b) => b.industry === "All Users")!;

  const stats = [
    { icon: "👥", label: "Subscribers", value: fmtInt(data.subscribers), sub: "Current active contacts on the list" },
    { icon: "📤", label: "Unsubscribes", value: fmtInt(data.unsubscribes), sub: "Current all-time opt-outs" },
    { icon: "🧹", label: "Cleaned", value: fmtInt(data.cleaned), sub: "Current cleaned contacts" },
    { icon: "📈", label: "Avg Open / Click", value: `${fmtPct(openRate)} / ${fmtPct(clickRate)}`, sub: active ? "Average for selected period" : "All-time audience average" },
  ];
  const snapshot: [string, string][] = [
    ["Audience Name", data.audience], ["Subscribers", fmtInt(data.subscribers)], ["Unsubscribes", fmtInt(data.unsubscribes)],
    ["Cleaned Records", fmtInt(data.cleaned)], ["Campaigns Sent", fmtInt(data.campaignsSent)], ["Tracking Since", fmtDate(data.trackingSince)],
  ];

  return (
    <>
      <div className="panel hero">
        <div className="hero-top">
          <div>
            <div className="kicker">Mailchimp Audience Overview</div>
            <div className="hero-title">{data.audience || "Cowley Audience"}</div>
            <div className="hero-sub">List health, engagement, and recent campaign performance at a glance.</div>
          </div>
          <div className="badges">
            <div className="hbadge"><div className="hbadge-lbl">Tracking Since</div><div className="hbadge-val">{fmtDate(data.trackingSince)}</div></div>
            <div className="hbadge"><div className="hbadge-lbl">Last Campaign</div><div className="hbadge-val">{fmtDate(data.lastCampaign)}</div></div>
            <div className="hbadge"><div className="hbadge-lbl">Campaigns Sent</div><div className="hbadge-val">{fmtInt(data.campaignsSent)}</div></div>
          </div>
        </div>
      </div>

      <div className="grid4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="card-top"><div className="card-lbl">{s.label}</div><div aria-hidden>{s.icon}</div></div>
            <div className="card-val" style={{ fontSize: 26 }}>{s.value}</div>
            <div className="card-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="sec-h" style={{ margin: "0 0 12px" }}><h2>Audience Snapshot</h2><span className="hint">Core list health and activity</span></div>
          <div className="mini-grid">{snapshot.map(([l, v]) => <div key={l} className="mini"><div className="mini-lbl">{l}</div><div className="mini-val">{v || "—"}</div></div>)}</div>
        </div>
        <div className="panel">
          <div className="sec-h" style={{ margin: "0 0 12px" }}><h2>Performance Snapshot</h2><span className="hint">Based on average campaign performance</span></div>
          <div className="perf-row"><div className="perf-head"><div className="perf-lbl">Average Open Rate</div><div className="perf-val">{fmtPct(openRate)}</div></div><div className="bar"><div className="bar-fill" style={{ width: `${Math.min(openRate, 100)}%` }} /></div></div>
          <div className="perf-row"><div className="perf-head"><div className="perf-lbl">Average Click Rate</div><div className="perf-val">{fmtPct(clickRate)}</div></div><div className="bar"><div className="bar-fill" style={{ width: `${Math.min(clickRate * 6, 100)}%` }} /></div></div>
          <div className="note">{active ? "Recalculated from campaigns in the selected Month / Year." : "Showing the overall Mailchimp audience averages."}</div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="sec-h"><h2>Industry Performance Comparison</h2><span className="hint">Benchmark reference vs. Cowley performance</span></div>
        <div className="panel" style={{ padding: 0, overflow: "auto" }}>
          <table className="bench">
            <thead><tr><th>Industry</th><th>Avg. Open Rate</th><th>Avg. Click Rate</th><th>Unsubscription Rate</th></tr></thead>
            <tbody>
              <tr className="cowley">
                <td>Cowley — {periodLabel || "All Time"}</td>
                <td>{filtered.length ? fmtPct(openRate) : "—"}{filtered.length > 0 && <Delta value={openRate} base={all.open} />}</td>
                <td>{filtered.length ? fmtPct(clickRate) : "—"}{filtered.length > 0 && <Delta value={clickRate} base={all.click} />}</td>
                <td>—</td>
              </tr>
              {BENCHMARKS.map((b) => (
                <tr key={b.industry}>
                  <td className="industry">{b.industry}<div style={{ fontSize: 10, fontWeight: 600, opacity: 0.72, marginTop: 3 }}>{b.label}</div></td>
                  <td>{fmtPct(b.open)}</td><td>{fmtPct(b.click)}</td><td>{fmtPct(b.unsub)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="note">Cowley&apos;s per-campaign unsubscribe rate is not tracked in the sheet. The Healthcare row is an external healthcare marketing benchmark, not a Mailchimp figure.</div>
      </div>

      <div className="date-filter">
        <span className="slab" style={{ fontWeight: 700 }}>Filter campaigns:</span>
        <select className="sel" aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All Years</option>{years.map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="sel" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">All Months</option>{MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
        </select>
        <button className="sel-btn" onClick={() => { setYear(""); setMonth(""); }}>Reset</button>
        <span className="hint" style={{ marginLeft: "auto" }}>{active ? `Showing ${periodLabel}` : "Showing all campaign dates"}</span>
      </div>

      <div className="sec-h mt"><h2>Recent Campaigns</h2><span className="hint">{shown.length} campaign{shown.length === 1 ? "" : "s"}</span></div>
      <div className="date-filter" style={{ margin: "0 0 12px" }}>
        <span className="slab" style={{ fontWeight: 700 }}>Sort by:</span>
        <select className="sel" aria-label="Sort field" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select className="sel" aria-label="Sort direction" value={dir} onChange={(e) => setDir(e.target.value as "asc" | "desc")}>
          <option value="desc">Highest / Newest first</option><option value="asc">Lowest / Oldest first</option>
        </select>
        <input className="search" type="search" placeholder="Search campaigns…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search campaigns" />
      </div>
      <div className="panel" style={{ overflow: "auto" }}>
        <table className="stable">
          <thead><tr><th>Campaign</th><th>Date</th><th className="num">Emails Sent</th><th className="num">Open Rate</th><th className="num">Click Rate</th><th className="num">Unique Opens</th><th className="num">Clicks</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={7} className="empty">No campaigns found for the selected period.</td></tr>}
            {shown.map((c, i) => (
              <tr key={`${c.name}-${c.date}-${i}`}>
                <td><span className="camp-title">{c.name}</span><span className="mc-chip">{fmtInt(c.uniqueOpens)} opens · {fmtInt(c.clicks)} clicks</span></td>
                <td className="subj">{fmtDate(c.date)}</td>
                <td className="num">{fmtInt(c.emailsSent)}</td>
                <td className="num">{fmtPct(c.openRate)}<span className={`rate-pill ${pillCls(c.openRate)}`}>Open</span></td>
                <td className="num">{fmtPct(c.clickRate)}<span className={`rate-pill ${pillCls(c.clickRate)}`}>Click</span></td>
                <td className="num">{fmtInt(c.uniqueOpens)}</td>
                <td className="num">{fmtInt(c.clicks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
