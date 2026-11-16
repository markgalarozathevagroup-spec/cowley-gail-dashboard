"use client";

import { useState } from "react";
import type { DocItem } from "@/lib/docTypes";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leadTypes";
import { fmtInt } from "@/lib/formatters";
import { sendJson } from "@/lib/sendJson";
import { useApi } from "@/lib/useApi";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

type Filter = LeadStatus | "All";

export default function DocumentLibrary() {
  const { state, retry } = useApi<{ items: DocItem[] }>("/api/documents", "Document Library");
  if (state.status === "loading") return <LoadingState label="Loading Document Library…" />;
  if (state.status === "error") return <ErrorState message={`Unable to load the Document Library. ${state.error}`} onRetry={retry} />;
  return <Body initial={state.data.items} />;
}

function Body({ initial }: { initial: DocItem[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("All");
  const [adding, setAdding] = useState(false);
  const count = (s: LeadStatus) => items.filter((i) => i.status === s).length;
  const visible = items.filter((i) => filter === "All" || i.status === filter);
  const patch = (row: number, p: Partial<DocItem>) => setItems((xs) => xs.map((x) => (x.row === row ? { ...x, ...p } : x)));

  const cards: { label: string; sub: string; value: number; f: Filter; cls: string }[] = [
    { label: "Total Documents", sub: "All statuses", value: items.length, f: "All", cls: "total" },
    { label: "Pending Review", sub: "Waiting for Gail", value: count("Pending Review"), f: "Pending Review", cls: "pending" },
    { label: "Approved", sub: "Ready / completed", value: count("Approved"), f: "Approved", cls: "approved" },
    { label: "Not Approved", sub: "Needs revision or removal", value: count("Not Approved"), f: "Not Approved", cls: "notapproved" },
  ];

  return (
    <>
      <div className="sec-h" style={{ marginTop: 0 }}><h2>Document Status</h2><span className="hint">Click a status to filter the list</span></div>
      <div className="doc-cards">
        {cards.map((c) => (
          <button key={c.label} className={`doc-card ${c.cls}${filter === c.f ? " active" : ""}`} aria-pressed={filter === c.f} onClick={() => setFilter(c.f)}>
            <div className="v">{fmtInt(c.value)}</div><div className="l">{c.label}</div><div className="hint" style={{ marginTop: 3 }}>{c.sub}</div>
          </button>
        ))}
      </div>

      <div className="sec-h">
        <h2>Documents for Gail</h2>
        <span className="hint">{visible.length} of {items.length} document{items.length === 1 ? "" : "s"}</span>
        <span className="spacer" />
        <button className="add-btn" onClick={() => setAdding((a) => !a)}>{adding ? "Close" : "＋ Add Document"}</button>
      </div>
      {adding && <AddForm onAdded={(d) => { setItems((xs) => [...xs, d]); setAdding(false); }} />}

      <div className="panel" style={{ overflow: "auto", marginTop: 12 }}>
        <table className="stable" style={{ tableLayout: "fixed", minWidth: 760 }}>
          <thead><tr><th style={{ width: "26%" }}>Title</th><th style={{ width: "36%" }}>Purpose</th><th style={{ width: "26%" }}>Document Link</th><th style={{ width: "12%" }}>Status</th></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={4} className="empty">No documents match this filter.</td></tr>}
            {visible.map((d) => <Row key={d.row} doc={d} onChange={(p) => patch(d.row, p)} />)}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 9, fontSize: 11.5 }}>Edit any field directly. Changes save when you leave a field or change the status.</p>
    </>
  );
}

function AddForm({ onAdded }: { onAdded: (d: DocItem) => void }) {
  const [f, setF] = useState({ title: "", purpose: "", link: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const { item } = await sendJson<{ item: DocItem }>("/api/documents", "POST", f);
      onAdded(item);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-box">
      <label>Title<input required className="doc-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label>Purpose<textarea rows={3} className="doc-input" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></label>
      <label>Document link<input type="url" placeholder="https://" className="doc-input" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></label>
      {err && <p role="alert" style={{ color: "var(--bad)", fontWeight: 700, margin: 0 }}>{err}</p>}
      <div><button className="btn" disabled={busy}>{busy ? "Adding…" : "Add to library"}</button></div>
    </form>
  );
}

function Row({ doc, onChange }: { doc: DocItem; onChange: (p: Partial<DocItem>) => void }) {
  const [draft, setDraft] = useState({ title: doc.title, purpose: doc.purpose, link: doc.link });
  const [msg, setMsg] = useState<Record<string, { ok: boolean; t: string }>>({});
  const say = (f: string, ok: boolean, t: string) => setMsg((m) => ({ ...m, [f]: { ok, t } }));

  async function save(field: "title" | "purpose" | "link" | "status", value: string) {
    if (field !== "status" && value.trim() === doc[field]) return;
    say(field, true, "Saving…");
    try {
      await sendJson("/api/documents", "PATCH", { row: doc.row, expectedTitle: doc.title, field, value });
      onChange({ [field]: value.trim() } as Partial<DocItem>);
      say(field, true, "Saved");
    } catch (e) {
      say(field, false, (e as Error).message);
    }
  }
  const note = (f: string) => msg[f] && <div role={msg[f].ok ? "status" : "alert"} className={`save-msg ${msg[f].ok ? "ok" : "err"}`}>{msg[f].t}</div>;

  return (
    <tr style={{ verticalAlign: "top" }}>
      <td><input className="doc-input" aria-label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onBlur={(e) => save("title", e.target.value)} />{note("title")}</td>
      <td><textarea className="doc-input" aria-label="Purpose" rows={3} value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} onBlur={(e) => save("purpose", e.target.value)} />{note("purpose")}</td>
      <td>
        <div style={{ display: "flex", gap: 7 }}>
          <input className="doc-input" aria-label="Document link" placeholder="https://..." value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} onBlur={(e) => save("link", e.target.value)} />
          {doc.link && /^https?:\/\//i.test(doc.link) && <a className="open-link" href={doc.link} target="_blank" rel="noopener noreferrer">Open ↗</a>}
        </div>
        {note("link")}
      </td>
      <td>
        <select className="status-sel" aria-label={`Status of ${doc.title}`} value={doc.status} onChange={(e) => save("status", e.target.value)}>
          {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        {note("status")}
      </td>
    </tr>
  );
}
