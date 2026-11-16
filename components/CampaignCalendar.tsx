"use client";

import { useEffect, useRef, useState } from "react";
import type { CalendarItem } from "@/app/api/campaign-calendar/route";
import { type LeadStatus } from "@/lib/leadTypes";
import { sendJson } from "@/lib/sendJson";
import { useApi } from "@/lib/useApi";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

type Filter = LeadStatus | "All Statuses";

const drivePreview = (url: string) => {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([-\w]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : "";
};

export default function CampaignCalendar() {
  const { state, retry } = useApi<{ items: CalendarItem[] }>("/api/campaign-calendar", "Campaign Calendar");
  if (state.status === "loading") return <LoadingState label="Loading Campaign Calendar…" cards={3} />;
  if (state.status === "error") return <ErrorState message={`Unable to load the Campaign Calendar. ${state.error}`} onRetry={retry} />;
  return <Body initial={state.data.items} />;
}

function Body({ initial }: { initial: CalendarItem[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("Pending Review");
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const visible = items.filter((i) => filter === "All Statuses" || i.status === filter);
  const update = (row: number, p: Partial<CalendarItem>) => setItems((xs) => xs.map((x) => (x.row === row ? { ...x, ...p } : x)));
  const open = items.find((i) => i.row === openRow) ?? null;

  async function setStatus(i: CalendarItem, status: LeadStatus) {
    setBusy(i.row);
    setErr("");
    try {
      await sendJson("/api/campaign-calendar", "PATCH", { row: i.row, theme: i.theme, status });
      update(i.row, { status });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="sec-h" style={{ marginTop: 0 }}>
        <h2>Campaign Calendar</h2>
        <span className="hint">{visible.length} of {items.length} campaign{items.length === 1 ? "" : "s"} shown</span>
        <span className="spacer" />
        <select className="pill-sel" style={{ marginLeft: 0 }} aria-label="Status filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option>Pending Review</option><option>Approved</option><option>Not Approved</option><option>All Statuses</option>
        </select>
      </div>
      {err && <p role="alert" style={{ color: "var(--bad)", fontWeight: 700 }}>{err}</p>}
      <div className="panel" style={{ overflow: "auto" }}>
        <table className="stable">
          <thead><tr><th>Month</th><th>Segment</th><th>Type</th><th>Theme / Subject</th><th>Gail&apos;s Feedback</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={7} className="empty">No campaigns match this status filter.</td></tr>}
            {visible.map((i) => (
              <tr key={i.row} className="row-clickable" onClick={() => setOpenRow(i.row)}>
                <td className="snm">{i.month}</td>
                <td className="subj">{i.segment}</td>
                <td className="subj">{i.type}</td>
                <td>{i.theme}</td>
                <td onClick={(e) => e.stopPropagation()}><Feedback item={i} onSaved={(f) => update(i.row, { feedback: f })} /></td>
                <td><span className={`badge ${i.status === "Approved" ? "b-green" : i.status === "Not Approved" ? "b-red" : "b-gray"}`}>{i.status}</span></td>
                <td style={{ minWidth: 118 }} onClick={(e) => e.stopPropagation()}>
                  {i.status === "Pending Review" ? (
                    <>
                      <button className="btn-app" disabled={busy === i.row} onClick={() => setStatus(i, "Approved")}>✓ Approve</button>
                      <button className="btn-rej" disabled={busy === i.row} onClick={() => setStatus(i, "Not Approved")}>Not Approved</button>
                    </>
                  ) : (
                    <>
                      <span className={i.status === "Approved" ? "st-app" : "st-rej"}>{i.status === "Approved" ? "✓ Approved" : "✕ Not Approved"}</span>
                      <button className="btn-undo-s" disabled={busy === i.row} onClick={() => setStatus(i, "Pending Review")}>Undo</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <CalModal item={open} busy={busy === open.row} onClose={() => setOpenRow(null)} onStatus={(s) => setStatus(open, s)} />}
    </>
  );
}

function Feedback({ item, onSaved }: { item: CalendarItem; onSaved: (f: string) => void }) {
  const [draft, setDraft] = useState(item.feedback);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await sendJson("/api/campaign-calendar", "PATCH", { row: item.row, theme: item.theme, feedback: draft });
      onSaved(draft);
      setMsg({ ok: true, t: "Saved" });
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <textarea className="fb-input" aria-label={`Gail's feedback for ${item.theme}`} placeholder="Add Gail's feedback..." maxLength={5000} value={draft} onChange={(e) => { setDraft(e.target.value); setMsg(null); }} />
      <button className="mini-btn" disabled={busy || draft === item.feedback} onClick={save}>Save feedback</button>
      {msg && <div role={msg.ok ? "status" : "alert"} className={`save-msg ${msg.ok ? "ok" : "err"}`}>{msg.t}</div>}
    </>
  );
}

function CalModal({ item, busy, onClose, onStatus }: { item: CalendarItem; busy: boolean; onClose: () => void; onStatus: (s: LeadStatus) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus(); };
  }, [onClose]);
  const preview = drivePreview(item.pdfUrl);
  const fields: [string, string, boolean][] = [["Description", item.description, true], ["Timing", item.timing, false], ["Format", item.format, false]];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cal-title" className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="m-id">{[item.segment, item.type].filter(Boolean).join(" · ")}</div>
          <div className="m-info"><h3 id="cal-title">{item.theme}</h3><div className="m-meta">{item.month}</div></div>
          <button className="m-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="m-fields">
          {fields.filter(([, v]) => v).map(([l, v, full]) => <div key={l} className={`mf${full ? " full" : ""}`}><div className="mf-lbl">{l}</div><div className="mf-val">{v}</div></div>)}
        </div>
        <div className="m-actions">
          {item.status === "Pending Review" ? (
            <>
              <button className="m-btn approve" disabled={busy} onClick={() => onStatus("Approved")}>✓ Approve Campaign</button>
              <button className="m-btn reject" disabled={busy} onClick={() => onStatus("Not Approved")}>✕ Not Approved</button>
            </>
          ) : (
            <>
              <button className="m-btn" disabled style={{ background: "#eaf5f6", border: "1px solid #b8dadd", color: "#397f89" }}>{item.status === "Approved" ? "✓ Approved" : "✕ Not Approved"}</button>
              <button className="m-btn" disabled={busy} style={{ background: "#fff", border: "2px solid #f27b5c", color: "#bd4e31" }} onClick={() => onStatus("Pending Review")}>↩ Undo</button>
            </>
          )}
        </div>
        {preview && (
          <div className="m-pdf">
            <div className="mf-lbl">📄 {item.month} newsletter draft</div>
            <iframe src={preview} title={`${item.theme} draft`} allowFullScreen />
            <div style={{ marginTop: 10 }}><a href={item.pdfUrl} target="_blank" rel="noopener noreferrer">↗ Open PDF in a new tab</a></div>
          </div>
        )}
      </div>
    </div>
  );
}
