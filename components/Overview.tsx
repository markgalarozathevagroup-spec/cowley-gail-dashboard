"use client";

import type { CalendarItem } from "@/app/api/campaign-calendar/route";
import type { HubspotSummary } from "@/app/api/hubspot/route";
import type { MailchimpData } from "@/app/api/mailchimp/route";
import type { GailItem } from "@/lib/docTypes";
import type { Lead } from "@/lib/leadTypes";
import type { SalesHoursData } from "@/lib/salesTypes";
import { Sparkline } from "@/lib/spark";
import { BENCHMARKS, EXCLUDED_CAMPAIGN_WORDS, MIN_BEST_CAMPAIGN_SENT } from "@/lib/constants";
import { fmtDate, fmtHours, fmtInt, fmtMoney, fmtPct } from "@/lib/formatters";
import { useApi } from "@/lib/useApi";

type Api<T> = ReturnType<typeof useApi<T>>;

function StatCard<T>({ icon, label, api, pick, note, spark }: {
  icon: string; label: string; api: Api<T>;
  pick: (d: T) => string; note?: (d: T) => string | undefined; spark?: (d: T) => React.ReactNode;
}) {
  const s = api.state;
  return (
    <div className="card">
      <div className="card-top"><div className="card-lbl">{label}</div><div aria-hidden>{icon}</div></div>
      {s.status === "loading" && <div role="status" aria-label={`Loading ${label}`}><div className="skel" style={{ height: 30, width: "70%" }} /></div>}
      {s.status === "error" && (
        <div role="alert" className="card-err">Unable to load<button onClick={api.retry}>Retry</button></div>
      )}
      {s.status === "ready" && (
        <>
          <div className="card-val">{pick(s.data)}</div>
          {note && <div className="card-sub">{note(s.data)}</div>}
          {spark && spark(s.data)}
        </>
      )}
    </div>
  );
}

const isExcluded = (name: string) => EXCLUDED_CAMPAIGN_WORDS.some((w) => name.toLowerCase().includes(w));
const plural = (n: number, one: string, many = `${one}s`) => `${fmtInt(n)} ${n === 1 ? one : many}`;

export default function Overview() {
  const mc = useApi<MailchimpData>("/api/mailchimp", "Mailchimp");
  const hs = useApi<HubspotSummary>("/api/hubspot?summary=1", "Hubspot");
  const leads = useApi<{ leads: Lead[] }>("/api/leads", "Leads");
  const sales = useApi<SalesHoursData>("/api/sales-hours", "Sales & Hours");
  const gail = useApi<{ items: GailItem[] }>("/api/gail-approval", "Gail Approval");
  const cal = useApi<{ items: CalendarItem[] }>("/api/campaign-calendar", "Campaign Calendar");

  const m = mc.state.status === "ready" ? mc.state.data : null;
  const L = leads.state.status === "ready" ? leads.state.data.leads : null;
  const S = sales.state.status === "ready" ? sales.state.data : null;
  const H = hs.state.status === "ready" ? hs.state.data : null;
  const G = gail.state.status === "ready" ? gail.state.data.items : null;
  const C = cal.state.status === "ready" ? cal.state.data.items : null;

  const best = m?.campaigns.filter((c) => !isExcluded(c.name) && c.emailsSent >= MIN_BEST_CAMPAIGN_SENT).sort((a, b) => b.openRate - a.openRate)[0];
  const pending = L?.filter((l) => l.status === "Pending Review").length ?? 0;
  const approved = L?.filter((l) => l.status === "Approved").length ?? 0;
  const topClient = S ? [...S.clients].sort((a, b) => b.qbBilled - a.qbBilled)[0] : null;

  // Smart insights: built only from sources that loaded
  const insights: { icon: string; tag: string; body: React.ReactNode }[] = [];
  if (m && m.campaigns.length) {
    const latest = [...m.campaigns].sort((a, b) => b.date.localeCompare(a.date))[0];
    const d = latest.openRate - m.avgOpenRate;
    const all = BENCHMARKS.find((b) => b.industry === "All Users")!;
    const dd = m.avgOpenRate - all.open;
    insights.push({ icon: "✉️", tag: "Mailchimp", body: <><b>{fmtInt(m.subscribers)}</b> subscribers with an average open rate of <b>{fmtPct(m.avgOpenRate)}</b> and click rate of <b>{fmtPct(m.avgClickRate)}</b>. Your latest campaign opened at <b>{fmtPct(latest.openRate)}</b> ({Math.abs(d).toFixed(2)} pts {d >= 0 ? "above" : "below"} average). Overall average is {Math.abs(dd).toFixed(2)} pts {dd >= 0 ? "above" : "below"} the Mailchimp all-users benchmark.</> });
  }
  if (H) insights.push({ icon: "🧩", tag: "HubSpot", body: <><b>{fmtInt(H.companies)}</b> companies are loaded in CRM with <b>{fmtInt(H.contacts)}</b> contacts.</> });
  if (S) insights.push({ icon: "💰", tag: "Revenue", body: <><b>{fmtMoney(S.summary.totalRevenueBilled)}</b> billed ({S.qbPeriod}). FunctionFox shows <b>{fmtHours(S.summary.totalTrackedHours)}</b> hours and <b>{fmtMoney(S.summary.trackedFees)}</b> in tracked fees; <b>{fmtMoney(S.summary.unbilledTrackedWork)}</b> of tracked work has no matching QuickBooks billing.</> });
  if (L) insights.push({ icon: "🎯", tag: "Leads", body: <><b>{fmtInt(pending)}</b> leads are pending review, <b>{fmtInt(approved)}</b> are approved, and <b>{fmtInt(L.filter((l) => l.rating.toLowerCase() === "hot").length)}</b> are rated Hot.</> });
  if (G) {
    const n = G.filter((i) => i.status === "Needs Gail").length;
    insights.push({ icon: "📝", tag: "Gail Approval", body: n ? <><b>{plural(n, "item")}</b> need Gail&apos;s attention.</> : <>Nothing is waiting on Gail.</> });
  }
  if (C) {
    const n = C.filter((i) => i.status === "Pending Review").length;
    if (n) insights.push({ icon: "📅", tag: "Campaign Calendar", body: <><b>{plural(n, "campaign")}</b> in the Campaign Calendar {n === 1 ? "is" : "are"} awaiting review.</> });
  }
  const loading = [mc, leads, sales, gail, cal, hs].some((x) => x.state.status === "loading");
  const failed = [mc, leads, sales, gail, cal, hs].some((x) => x.state.status === "error");

  return (
    <>
      <div className="panel hero">
        <div className="hero-top">
          <div>
            <div className="kicker">Executive Dashboard</div>
            <div className="hero-title">A visual snapshot of Cowley&apos;s marketing, pipeline, and revenue performance.</div>
            <div className="hero-sub">See the health of the newsletter audience, CRM, lead review queue, and revenue drivers in one overview built for quick scanning.</div>
          </div>
          <div className="badges">
            <div className="hbadge"><div className="hbadge-lbl">Audience</div><div className="hbadge-val">{m ? `${fmtInt(m.subscribers)} subscribers` : "—"}</div></div>
            <div className="hbadge"><div className="hbadge-lbl">Pipeline</div><div className="hbadge-val">{L ? `${fmtInt(pending)} pending review` : "—"}</div></div>
          </div>
        </div>
      </div>

      <div className="grid4">
        <StatCard icon="👥" label="Total Subscribers" api={mc} pick={(d) => fmtInt(d.subscribers)} note={(d) => d.audience} />
        <StatCard icon="💵" label="Revenue Billed" api={sales} pick={(d) => fmtMoney(d.summary.totalRevenueBilled)} note={(d) => `QuickBooks, ${d.qbPeriod}`} />
        <StatCard icon="📝" label="Leads Pending" api={leads} pick={(d) => fmtInt(d.leads.filter((l) => l.status === "Pending Review").length)} note={() => "Awaiting Gail's review"} />
        <StatCard icon="✅" label="Leads Approved" api={leads} pick={(d) => fmtInt(d.leads.filter((l) => l.status === "Approved").length)} note={(d) => `${fmtInt(d.leads.filter((l) => l.status === "Not Approved").length)} not approved`} />
      </div>
      <div className="grid4">
        <StatCard icon="📬" label="Avg Open Rate" api={mc} pick={(d) => fmtPct(d.avgOpenRate)} note={() => "All campaigns"}
          spark={(d) => <Sparkline data={[...d.campaigns].sort((a, b) => a.date.localeCompare(b.date)).map((c) => c.openRate)} color="#5a9fa9" />} />
        <StatCard icon="🖱️" label="Avg Click Rate" api={mc} pick={(d) => fmtPct(d.avgClickRate)} note={() => "All campaigns"}
          spark={(d) => <Sparkline data={[...d.campaigns].sort((a, b) => a.date.localeCompare(b.date)).map((c) => c.clickRate)} color="#f27b5c" />} />
        <StatCard icon="🧩" label="HubSpot Companies" api={hs} pick={(d) => fmtInt(d.companies)} note={(d) => `${fmtInt(d.contacts)} contacts`} />
        <StatCard icon="⏱️" label="Function Fox" api={sales} pick={(d) => `${fmtHours(d.summary.totalTrackedHours)} hrs`} note={(d) => `${fmtMoney(d.summary.trackedFees)} total fees`} />
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="sec-h" style={{ margin: "0 0 12px" }}><h2>Smart Insights</h2></div>
          <div className="ins-list">
            {loading && insights.length === 0 && <p role="status" className="hint">Loading insights…</p>}
            {!loading && insights.length === 0 && <p className="hint">No insights are available right now.</p>}
            {insights.map((i) => (
              <div key={i.tag} className="ins-card"><div className="ins-ic" aria-hidden>{i.icon}</div><div className="ins-copy"><span className="ins-tag">{i.tag}</span>{i.body}</div></div>
            ))}
            {failed && !loading && <p className="hint">Some insights are unavailable because a data source did not load.</p>}
          </div>
        </div>
        <div className="panel">
          <div className="sec-h" style={{ margin: "0 0 12px" }}><h2>Key Highlights</h2><span className="hint">Top items at a glance</span></div>
          <div className="high-list">
            {best && <div className="high-item"><div className="high-lbl">Best Campaign</div><div className="high-main">{best.name}</div><div className="high-sub">{fmtDate(best.date)} · {fmtPct(best.openRate)} open rate · {fmtInt(best.clicks)} clicks</div></div>}
            {topClient && <div className="high-item"><div className="high-lbl">Top Revenue Customer</div><div className="high-main">{topClient.name}</div><div className="high-sub">{fmtMoney(topClient.qbBilled)} billed</div></div>}
            {L && <div className="high-item"><div className="high-lbl">Lead Review Queue</div><div className="high-main"><span className="chip">{fmtInt(pending)} pending</span><span className="chip">{fmtInt(approved)} approved</span></div><div className="high-sub">Review pending leads first, then move approved leads into outreach.</div></div>}
            {S && <div className="high-item"><div className="high-lbl">Function Fox Summary</div><div className="high-main">{fmtHours(S.summary.totalTrackedHours)} hours logged</div><div className="high-sub">{fmtMoney(S.summary.trackedFees)} total fees recorded.</div></div>}
            {!best && !topClient && !L && !S && <p className="hint">{loading ? "Loading…" : "No highlights available."}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
