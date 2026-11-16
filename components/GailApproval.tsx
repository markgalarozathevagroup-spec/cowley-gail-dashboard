"use client";

import { useState } from "react";
import { GAIL_STATUSES, type GailItem, type GailStatus } from "@/lib/docTypes";
import { fmtDate, fmtInt } from "@/lib/formatters";
import { sendJson } from "@/lib/sendJson";
import { useApi } from "@/lib/useApi";
import ErrorState from "./ErrorState";
import Header from "./Header";
import LoadingState from "./LoadingState";

type Filter = GailStatus | "All";

export default function GailApproval() {
  const { state, retry } = useApi<{ items: GailItem[] }>("/api/gail-approval", "Gail Approval");
  return (
    <>
      <Header title="Gail Approval" subtitle="Items waiting on Gail" />
      {state.status === "loading" && <LoadingState label="Loading Gail Approval…" />}
      {state.status === "error" && <ErrorState message={`Unable to load Gail Approval. ${state.error}`} onRetry={retry} />}
      {state.status === "ready" && <Body initial={state.data.items} />}
    </>
  );
}

function Body({ initial }: { initial: GailItem[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("All");
  const count = (s: GailStatus) => items.filter((i) => i.status === s).length;
  const visible = items.filter((i) => filter === "All" || i.status === filter);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {GAIL_STATUSES.map((s) => (
          <button
            key={s}
            aria-pressed={filter === s}
            onClick={() => setFilter(filter === s ? "All" : s)}
            className={`rounded-xl border-2 bg-white p-5 text-left hover:border-teal ${filter === s ? "border-navy" : "border-line"}`}
          >
            <span className="block text-base font-semibold text-muted">{s}</span>
            <span className={`mt-1 block text-3xl font-bold ${s === "Needs Gail" ? "text-coral" : "text-navy"}`}>{fmtInt(count(s))}</span>
          </button>
        ))}
      </div>
      <p className="text-base text-muted">{filter === "All" ? `Showing all ${items.length} items.` : `Showing ${visible.length} “${filter}” items. Click the card again to show all.`}</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-base">
          <thead className="bg-surface text-sm uppercase tracking-wide text-muted">
            <tr>
              <th className="p-4">Date</th>
              <th className="p-4">Item</th>
              <th className="p-4">Source Report</th>
              <th className="p-4">What Gail Needs To Address</th>
              <th className="p-4">Status</th>
              <th className="p-4 min-w-64">Notes</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={6} className="p-6 text-muted">No items in this status.</td></tr>}
            {visible.map((i) => (
              <Row key={i.row} item={i} onChange={(p) => setItems((xs) => xs.map((x) => (x.row === i.row ? { ...x, ...p } : x)))} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ item, onChange }: { item: GailItem; onChange: (p: Partial<GailItem>) => void }) {
  const [draft, setDraft] = useState(item.notes);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(body: object, apply: () => void, text: string) {
    setBusy(true);
    setMsg(null);
    try {
      await sendJson("/api/gail-approval", "PATCH", { row: item.row, item: item.item, ...body });
      apply();
      setMsg({ ok: true, text });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-line align-top">
      <td className="p-4 whitespace-nowrap">{fmtDate(item.date)}</td>
      <td className="p-4 font-bold text-navy">{item.item}</td>
      <td className="p-4 text-sm text-muted">{item.source}</td>
      <td className="p-4 max-w-md">{item.todo}</td>
      <td className="p-4">
        <select
          aria-label={`Status of ${item.item}`}
          disabled={busy}
          value={item.status}
          onChange={(e) => save({ status: e.target.value }, () => onChange({ status: e.target.value as GailStatus }), "Status saved.")}
          className="rounded-lg border-2 border-line bg-white px-3 py-2.5 text-base font-semibold text-ink"
        >
          {GAIL_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </td>
      <td className="p-4">
        <textarea
          aria-label={`Notes for ${item.item}`}
          rows={3}
          maxLength={5000}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setMsg(null); }}
          className="w-full rounded-lg border-2 border-line bg-white p-3 text-base text-ink"
        />
        <button
          disabled={busy || draft === item.notes}
          onClick={() => save({ notes: draft }, () => onChange({ notes: draft }), "Notes saved.")}
          className="mt-2 rounded-lg border-2 border-navy px-4 py-2 text-base font-semibold text-navy hover:bg-surface disabled:opacity-40"
        >
          Save notes
        </button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-1 text-sm font-semibold ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
      </td>
    </tr>
  );
}
