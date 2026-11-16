"use client";

import { useState } from "react";
import { GAIL_STATUSES, type GailItem, type GailStatus } from "@/lib/docTypes";
import { fmtDate, fmtInt } from "@/lib/formatters";
import { sendJson } from "@/lib/sendJson";
import { useApi } from "@/lib/useApi";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

type Filter = GailStatus | "All";
const CLS: Record<GailStatus, string> = { "Needs Gail": "pending needs", "In Review": "review", Done: "done", "Not Needed": "none" };

export default function GailApproval() {
  const { state, retry } = useApi<{ items: GailItem[] }>("/api/gail-approval", "Gail Approval");
  return (
    <section aria-label="Gail Approval">
      <div className="sec-h" style={{ marginTop: 0 }}><h2 style={{ fontSize: 16 }}>Gail Approval</h2><span className="hint">Items from EOD / EOW reports that need Gail&apos;s review, decision, or approval</span></div>
      {state.status === "loading" && <LoadingState label="Loading Gail Approval…" cards={4} />}
      {state.status === "error" && <ErrorState message={`Unable to load Gail Approval. ${state.error}`} onRetry={retry} />}
      {state.status === "ready" && <Body initial={state.data.items} />}
    </section>
  );
}

function Body({ initial }: { initial: GailItem[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("All");
  const count = (s: GailStatus) => items.filter((i) => i.status === s).length;
  const visible = items.filter((i) => filter === "All" || i.status === filter);
  const patch = (row: number, p: Partial<GailItem>) => setItems((xs) => xs.map((x) => (x.row === row ? { ...x, ...p } : x)));
  return (
    <>
      <div className="doc-cards" style={{ marginBottom: 12 }}>
        {GAIL_STATUSES.map((s) => (
          <button key={s} className={`doc-card ${CLS[s]}${filter === s ? " active" : ""}`} aria-pressed={filter === s} onClick={() => setFilter(filter === s ? "All" : s)}>
            <div className="v">{fmtInt(count(s))}</div><div className="l">{s}</div>
          </button>
        ))}
      </div>
      <div className="panel" style={{ overflow: "auto" }}>
        <table className="stable" style={{ tableLayout: "fixed", minWidth: 820 }}>
          <thead><tr><th style={{ width: "9%" }}>Date</th><th style={{ width: "19%" }}>Item / Source</th><th style={{ width: "36%" }}>What Gail Needs To Address</th><th style={{ width: "13%" }}>Status</th><th style={{ width: "23%" }}>Notes</th></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={5} className="empty">No items in this status.</td></tr>}
            {visible.map((i) => <Row key={i.row} item={i} onChange={(p) => patch(i.row, p)} />)}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ item, onChange }: { item: GailItem; onChange: (p: Partial<GailItem>) => void }) {
  const [draft, setDraft] = useState(item.notes);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function save(body: object, apply: () => void, t: string) {
    setBusy(true);
    setMsg(null);
    try {
      await sendJson("/api/gail-approval", "PATCH", { row: item.row, item: item.item, ...body });
      apply();
      setMsg({ ok: true, t });
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <tr style={{ verticalAlign: "top" }}>
      <td className="subj" style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{fmtDate(item.date)}</td>
      <td><div style={{ fontWeight: 800, color: "var(--gray900)", marginBottom: 3 }}>{item.item}</div><div className="hint" style={{ fontSize: 10.5 }}>{item.source}</div></td>
      <td style={{ lineHeight: 1.45 }}>{item.todo}</td>
      <td>
        <select className="status-sel" aria-label={`Status of ${item.item}`} disabled={busy} value={item.status} onChange={(e) => save({ status: e.target.value }, () => onChange({ status: e.target.value as GailStatus }), "Status saved.")}>
          {GAIL_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </td>
      <td>
        <textarea className="ga-notes" aria-label={`Notes for ${item.item}`} rows={3} maxLength={5000} placeholder="Add notes..." value={draft} onChange={(e) => { setDraft(e.target.value); setMsg(null); }} />
        <button className="mini-btn" disabled={busy || draft === item.notes} onClick={() => save({ notes: draft }, () => onChange({ notes: draft }), "Notes saved.")}>Save notes</button>
        {msg && <div role={msg.ok ? "status" : "alert"} className={`save-msg ${msg.ok ? "ok" : "err"}`}>{msg.t}</div>}
      </td>
    </tr>
  );
}
