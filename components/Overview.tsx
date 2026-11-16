"use client";

import type { CalendarItem } from "@/app/api/campaign-calendar/route";
import type { HubspotData } from "@/app/api/hubspot/route";
import type { MailchimpData } from "@/app/api/mailchimp/route";
import type { GailItem } from "@/lib/docTypes";
import type { Lead } from "@/lib/leadTypes";
import type { SalesHoursData } from "@/lib/salesTypes";
import { BENCHMARKS, EXCLUDED_CAMPAIGN_WORDS, MIN_BEST_CAMPAIGN_SENT } from "@/lib/constants";
import { fmtDate, fmtInt, fmtMoney, fmtPct } from "@/lib/formatters";
import { useApi } from "@/lib/useApi";
import Header from "./Header";

type Api<T> = ReturnType<typeof useApi<T>>["state"];

function StatCard<T>({ label, api, retry, pick, note }: {
  label: string;
  api: Api<T>;
  retry: () => void;
  pick: (d: T) => string;
  note?: (d: T) => string | undefined;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <p className="text-base font-semibold text-muted">{label}</p>
      {api.status === "loading" && (
        <div role="status" aria-label={`Loading ${label}`} className="mt-2 animate-pulse">
          <div className="h-9 w-3/4 rounded bg-line" />
        </div>
      )}
      {api.status === "error" && (
        <div role="alert" className="mt-1">
          <p className="text-base font-semibold text-bad">Unable to load</p>
          <button onClick={retry} className="mt-1 text-base font-semibold text-navy underline">Retry</button>
        </div>
      )}
      {api.status === "ready" && (
        <>
          <p className="mt-1 text-3xl font-bold text-navy">{pick(api.data)}</p>
          {note && <p className="mt-1 text-sm text-muted">{note(api.data)}</p>}
        </>
      )}
    </div>
  );
}

const isExcluded = (name: string) => EXCLUDED_CAMPAIGN_WORDS.some((w) => name.toLowerCase().includes(w));
const plural = (n: number, one: string, many = `${one}s`) => `${fmtInt(n)} ${n === 1 ? one : many}`;

export default function Overview() {
  const mc = useApi<MailchimpData>("/api/mailchimp", "Mailchimp");
  const hs = useApi<HubspotData>("/api/hubspot", "Hubspot");
  const leads = useApi<{ leads: Lead[] }>("/api/leads", "Leads");
  const sales = useApi<SalesHoursData>("/api/sales-hours", "Sales & Hours");
  const gail = useApi<{ items: GailItem[] }>("/api/gail-approval", "Gail Approval");
  const cal = useApi<{ items: CalendarItem[] }>("/api/campaign-calendar", "Campaign Calendar");

  // Smart Insights: each one is built only from sources that loaded.
  const insights: { text: string; href?: string }[] = [];
  const m = mc.state.status === "ready" ? mc.state.data : null;
  if (m && m.campaigns.length) {
    const latest = [...m.campaigns].sort((a, b) => b.date.localeCompare(a.date))[0];
    const d = latest.openRate - m.avgOpenRate;
    insights.push({ text: `Your latest campaign, “${latest.name}” (${fmtDate(latest.date)}), opened at ${fmtPct(latest.openRate)} — ${Math.abs(d).toFixed(2)} points ${d >= 0 ? "above" : "below"} your overall average of ${fmtPct(m.avgOpenRate)}.`, href: "/mailchimp" });
    const all = BENCHMARKS.find((b) => b.industry === "All Users")!;
    const dd = m.avgOpenRate - all.open;
    insights.push({ text: `Your average open rate is ${Math.abs(dd).toFixed(2)} points ${dd >= 0 ? "above" : "below"} the Mailchimp all-users benchmark of ${fmtPct(all.open)}.`, href: "/mailchimp" });
    const best = m.campaigns.filter((c) => !isExcluded(c.name) && c.emailsSent >= MIN_BEST_CAMPAIGN_SENT).sort((a, b) => b.openRate - a.openRate)[0];
    if (best) insights.push({ text: `Best-performing campaign (sent to 100+ people): “${best.name}” at ${fmtPct(best.openRate)} open rate.`, href: "/mailchimp" });
  }
  if (leads.state.status === "ready") {
    const L = leads.state.data.leads;
    const pending = L.filter((l) => l.status === "Pending Review").length;
    const hotApproved = L.filter((l) => l.status === "Approved" && l.rating.toLowerCase() === "hot").length;
    insights.push({ text: pending ? `${plural(pending, "lead")} waiting for review.` : `No leads are waiting for review. ${plural(hotApproved, "approved lead")} ${hotApproved === 1 ? "is" : "are"} rated Hot.`, href: "/leads" });
  }
  if (sales.state.status === "ready") {
    const s = sales.state.data;
    if (s.summary.unbilledTrackedWork > 0) insights.push({ text: `${fmtMoney(s.summary.unbilledTrackedWork)} of tracked FunctionFox work has no matching QuickBooks billing.`, href: "/sales-hours" });
    insights.push({ text: `QuickBooks billing is ${fmtMoney(Math.abs(s.summary.revenueGap))} ${s.summary.revenueGap >= 0 ? "above" : "below"} FunctionFox tracked fees.`, href: "/sales-hours" });
  }
  if (gail.state.status === "ready") {
    const n = gail.state.data.items.filter((i) => i.status === "Needs Gail").length;
    insights.push({ text: n ? `${plural(n, "item")} need${n === 1 ? "s" : ""} Gail's attention.` : "Nothing is waiting on Gail.", href: "/gail-approval" });
  }
  if (cal.state.status === "ready") {
    const n = cal.state.data.items.filter((i) => i.status === "Pending Review").length;
    if (n) insights.push({ text: `${plural(n, "campaign")} in the Campaign Calendar ${n === 1 ? "is" : "are"} awaiting review.`, href: "/campaign-calendar" });
  }
  const loading = [mc, leads, sales, gail, cal].some((x) => x.state.status === "loading");
  const failed = [mc, leads, sales, gail, cal].some((x) => x.state.status === "error");

  return (
    <>
      <Header title="Overview" subtitle="Where things stand today" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Mailchimp Subscribers" api={mc.state} retry={mc.retry} pick={(d) => fmtInt(d.subscribers)} note={(d) => d.audience} />
        <StatCard label="Average Open Rate" api={mc.state} retry={mc.retry} pick={(d) => fmtPct(d.avgOpenRate)} note={() => "All campaigns"} />
        <StatCard label="Average Click Rate" api={mc.state} retry={mc.retry} pick={(d) => fmtPct(d.avgClickRate)} note={() => "All campaigns"} />
        <StatCard label="Campaigns Sent" api={mc.state} retry={mc.retry} pick={(d) => fmtInt(d.campaignsSent)} note={(d) => (d.lastCampaign ? `Last sent ${fmtDate(d.lastCampaign)}` : undefined)} />
        <StatCard label="Revenue Billed" api={sales.state} retry={sales.retry} pick={(d) => fmtMoney(d.summary.totalRevenueBilled)} note={(d) => `QuickBooks, ${d.qbPeriod}`} />
        <StatCard label="HubSpot Companies" api={hs.state} retry={hs.retry} pick={(d) => fmtInt(d.companies)} note={(d) => `${fmtInt(d.contacts)} contacts`} />
        <StatCard label="Leads Pending" api={leads.state} retry={leads.retry} pick={(d) => fmtInt(d.leads.filter((l) => l.status === "Pending Review").length)} note={(d) => `of ${fmtInt(d.leads.length)} leads`} />
        <StatCard label="Leads Approved" api={leads.state} retry={leads.retry} pick={(d) => fmtInt(d.leads.filter((l) => l.status === "Approved").length)} note={(d) => `${fmtInt(d.leads.filter((l) => l.status === "Not Approved").length)} not approved`} />
      </div>

      <section aria-label="Smart Insights" className="mt-10">
        <h2 className="mb-3 text-2xl font-bold text-navy">Smart Insights</h2>
        <div className="rounded-xl border border-line bg-white p-6">
          {loading && insights.length === 0 && <p role="status" className="text-lg text-muted">Loading insights…</p>}
          {!loading && insights.length === 0 && <p className="text-lg text-muted">No insights are available right now.</p>}
          <ul className="space-y-4">
            {insights.map((i) => (
              <li key={i.text} className="flex gap-3 text-lg">
                <span aria-hidden className="mt-2 h-3 w-3 shrink-0 rounded-full bg-teal" />
                <span>{i.text}{i.href && <> <a href={i.href} className="font-semibold text-navy underline">Open</a></>}</span>
              </li>
            ))}
          </ul>
          {failed && !loading && <p className="mt-4 text-base text-muted">Some insights are unavailable because a data source did not load.</p>}
        </div>
      </section>
    </>
  );
}
