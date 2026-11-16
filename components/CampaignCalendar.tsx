"use client";

import { useState } from "react";
import type { CalendarItem } from "@/app/api/campaign-calendar/route";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leadTypes";
import { fmtInt } from "@/lib/formatters";
import { useApi } from "@/lib/useApi";
import ErrorState from "./ErrorState";
import Header from "./Header";
import LoadingState from "./LoadingState";

type Filter = LeadStatus | "All Statuses";

const statusCls = (s: LeadStatus) =>
  s === "Approved" ? "bg-good text-white" : s === "Not Approved" ? "bg-bad text-white" : "bg-surface text-ink border border-line";

async function patch(body: object) {
  const res = await fetch("/api/campaign-calendar", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(j?.error || "Unable to save.");
}

export default function CampaignCalendar() {
  const { state, retry } = useApi<{ items: CalendarItem[] }>("/api/campaign-calendar", "Campaign Calendar");
  return (
    <>
      <Header title="Campaign Calendar" subtitle="Planned email campaigns for Gail's review" />
      {state.status === "loading" && <LoadingState label="Loading Campaign Calendar…" cards={3} />}
      {state.status === "error" && <ErrorState message={`Unable to load the Campaign Calendar. ${state.error}`} onRetry={retry} />}
      {state.status === "ready" && <Body initial={state.data.items} />}
    </>
  );
}

function Body({ initial }: { initial: CalendarItem[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("Pending Review");
  const visible = items.filter((i) => filter === "All Statuses" || i.status === filter);
  const update = (row: number, p: Partial<CalendarItem>) => setItems((xs) => xs.map((x) => (x.row === row ? { ...x, ...p } : x)));
  const count = (s: LeadStatus) => items.filter((i) => i.status === s).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Filter by status">
        {([...LEAD_STATUSES, "All Statuses"] as Filter[]).map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border-2 px-4 py-3 text-base font-semibold ${filter === f ? "border-navy bg-navy text-white" : "border-line bg-white hover:border-teal"}`}
          >
            {f} {f === "All Statuses" ? `(${fmtInt(items.length)})` : `(${fmtInt(count(f))})`}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-base">
          <thead className="bg-surface text-sm uppercase tracking-wide text-muted">
            <tr>
              <th className="p-4">Month</th>
              <th className="p-4">Segment</th>
              <th className="p-4">Type</th>
              <th className="p-4">Theme / Subject</th>
              <th className="p-4 min-w-72">Gail&apos;s Feedback</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={7} className="p-6 text-muted">No campaigns match this filter.</td></tr>}
            {visible.map((i) => (
              <Row key={i.row} item={i} onChange={(p) => update(i.row, p)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ item, onChange }: { item: CalendarItem; onChange: (p: Partial<CalendarItem>) => void }) {
  const [draft, setDraft] = useState(item.feedback);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = draft !== item.feedback;
  const pdf = item.pdfUrl.startsWith("https://drive.google.com/") ? item.pdfUrl : "";

  async function run(body: object, apply: () => void, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      await patch({ row: item.row, theme: item.theme, ...body });
      apply();
      setMsg({ ok: true, text: okText });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-line align-top">
      <td className="p-4 whitespace-nowrap font-semibold">{item.month}</td>
      <td className="p-4">{item.segment}</td>
      <td className="p-4">{item.type}</td>
      <td className="p-4 max-w-md">
        <p className="font-bold text-navy">{item.theme}</p>
        {item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}
        {item.timing && <p className="mt-1 text-sm text-muted">Timing: {item.timing}</p>}
        {pdf && <a href={pdf} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-semibold text-navy underline">View draft</a>}
      </td>
      <td className="p-4">
        <textarea
          aria-label={`Gail's feedback for ${item.theme}`}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setMsg(null); }}
          rows={3}
          maxLength={5000}
          className="w-full rounded-lg border-2 border-line bg-white p-3 text-base text-ink"
        />
        <button
          disabled={!dirty || busy}
          onClick={() => run({ feedback: draft }, () => onChange({ feedback: draft }), "Feedback saved.")}
          className="mt-2 rounded-lg border-2 border-navy px-4 py-2 text-base font-semibold text-navy hover:bg-surface disabled:opacity-40"
        >
          Save feedback
        </button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-1 text-sm font-semibold ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
      </td>
      <td className="p-4"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold ${statusCls(item.status)}`}>{item.status}</span></td>
      <td className="p-4">
        <div className="flex flex-col gap-2">
          <button
            disabled={busy}
            onClick={() => run({ status: "Approved" }, () => onChange({ status: "Approved" }), "Marked Approved.")}
            className="rounded-lg bg-good px-4 py-3 text-base font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            ✓ Approve
          </button>
          <button
            disabled={busy}
            onClick={() => run({ status: "Not Approved" }, () => onChange({ status: "Not Approved" }), "Marked Not Approved.")}
            className="rounded-lg bg-bad px-4 py-3 text-base font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            Not Approved
          </button>
        </div>
      </td>
    </tr>
  );
}
