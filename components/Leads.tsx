"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LEAD_SEGMENTS, type Lead, type LeadStatus } from "@/lib/leadTypes";
import { fmtInt } from "@/lib/formatters";
import { sendJson } from "@/lib/sendJson";
import { useApi } from "@/lib/useApi";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

type StatusFilter = LeadStatus | "All Statuses";

const segCls = (s: string) => {
  const v = s.toLowerCase();
  return v.includes("non-profit") ? "sp-np" : v.includes("health") ? "sp-hc" : v.includes("b2b") ? "sp-b2b" : "sp-def";
};
const ratingBadge = (r: string) =>
  r.toLowerCase() === "hot" ? <span className="hot-b">🔥 Hot</span> : r.toLowerCase() === "warm" ? <span className="warm-b">⚡ Warm</span> : <span className="hint">{r || "—"}</span>;

export default function Leads() {
  const { state, retry } = useApi<{ leads: Lead[] }>("/api/leads", "Leads");
  if (state.status === "loading") return <LoadingState label="Loading Leads…" />;
  if (state.status === "error") return <ErrorState message={`Unable to load Leads. ${state.error}`} onRetry={retry} />;
  return <Body initial={state.data.leads} />;
}

function Body({ initial }: { initial: Lead[] }) {
  const [leads, setLeads] = useState(initial);
  const [segment, setSegment] = useState("All Segments");
  const [status, setStatus] = useState<StatusFilter>("Pending Review");
  const [q, setQ] = useState("");
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const inSeg = useMemo(() => leads.filter((l) => segment === "All Segments" || l.section.toLowerCase() === segment.toLowerCase()), [leads, segment]);
  const count = (s: LeadStatus) => inSeg.filter((l) => l.status === s).length;
  const rows = inSeg.filter(
    (l) => (status === "All Statuses" || l.status === status) &&
      (!q || `${l.company} ${l.decisionMaker} ${l.location} ${l.signal}`.toLowerCase().includes(q.toLowerCase())),
  );
  const open = leads.find((l) => l.row === openRow) ?? null;

  async function act(lead: Lead, next: LeadStatus, closeModal = false) {
    setBusyRow(lead.row);
    setError("");
    setNote("");
    try {
      const res = await sendJson<{ hubspot?: { status: string; detail?: string } }>("/api/leads", "PATCH", { row: lead.row, leadId: lead.id, status: next });
      const h = res.hubspot;
      setNote(
        h?.status === "updated" ? `Saved. ${lead.company} was also updated in HubSpot.`
          : h ? `Saved to the sheet. HubSpot was not changed: ${h.detail ?? h.status}`
          : "Saved.",
      );
      setLeads((ls) => ls.map((l) => (l.row === lead.row ? { ...l, status: next } : l)));
      if (closeModal) setOpenRow(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyRow(null);
    }
  }

  const stat = (cls: string, v: number, l: string, sub: string, f?: LeadStatus) => {
    const inner = (<><div className="stat-val" style={{ color: cls }}>{fmtInt(v)}</div><div className="stat-lbl">{l}</div><div className="stat-sub">{sub}</div></>);
    return f ? <button key={l} className={`stat${status === f ? " active" : ""}`} aria-pressed={status === f} onClick={() => setStatus(f)}>{inner}</button> : <div key={l} className="stat">{inner}</div>;
  };

  return (
    <>
      <div className="banner"><span aria-hidden>🎯</span> Review the qualified leads — approve or mark Not Approved for each one.</div>
      <div className="stat4">
        {stat("#5a9fa9", count("Pending Review"), "Pending Review", "Awaiting your decision", "Pending Review")}
        {stat("#f27b5c", inSeg.filter((l) => l.rating.toLowerCase() === "hot").length, "Hot Leads", "Rated Hot")}
        {stat("#22a35f", count("Approved"), "Approved", "Ready for outreach", "Approved")}
        {stat("#d34b46", count("Not Approved"), "Not Approved", "Marked by Gail", "Not Approved")}
      </div>

      <div className="pill-row">
        {["All Segments", ...LEAD_SEGMENTS].map((s) => <button key={s} className={`pill${segment === s ? " active" : ""}`} onClick={() => setSegment(s)}>{s}</button>)}
        <select className="pill-sel" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option>Pending Review</option><option>Approved</option><option>Not Approved</option><option>All Statuses</option>
        </select>
      </div>
      <input className="search-wide" type="search" placeholder="🔍 Company, contact, location, signal…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search leads" />
      <div className="count">{fmtInt(rows.length)} leads shown</div>
      {error && !open && <p role="alert" style={{ color: "var(--bad)", fontWeight: 700 }}>{error}</p>}
      {note && <p role="status" style={{ color: "var(--brand-ink)", fontWeight: 700, margin: "0 0 8px" }}>{note}</p>}

      <div className="panel" style={{ overflow: "auto" }}>
        <table className="stable">
          <thead><tr><th>Section</th><th>Company</th><th>Location</th><th>Decision Maker</th><th className="num">Score</th><th>Rating</th><th>Buying Signal</th><th>Action</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="empty">No leads{q ? ` matching "${q}"` : ""}.</td></tr>}
            {rows.map((l) => (
              <tr key={l.row} className="row-clickable" onClick={() => { setError(""); setOpenRow(l.row); }}>
                <td><span className={`sp ${segCls(l.section)}`}>{l.section || "—"}</span></td>
                <td><strong>{l.company}</strong><div className="hint">{l.id}</div></td>
                <td>{l.location || "—"}</td>
                <td><strong>{l.decisionMaker || "—"}</strong><div className="hint">{l.title}</div></td>
                <td className="num">{l.score || "—"} ⚡</td>
                <td>{ratingBadge(l.rating)}</td>
                <td><span className="sig-snip">{l.signal.length > 90 ? `${l.signal.slice(0, 87)}...` : l.signal || "—"}</span></td>
                <td style={{ minWidth: 120 }} onClick={(e) => e.stopPropagation()}>
                  {l.status === "Pending Review" ? (
                    <>
                      <button className="btn-app" disabled={busyRow === l.row} onClick={() => act(l, "Approved")}>✓ Approve</button>
                      <button className="btn-rej" disabled={busyRow === l.row} onClick={() => act(l, "Not Approved")}>Not Approved</button>
                    </>
                  ) : (
                    <>
                      <span className={l.status === "Approved" ? "st-app" : "st-rej"}>{l.status === "Approved" ? "✓ Approved" : "✕ Not Approved"}</span>
                      <button className="btn-undo-s" disabled={busyRow === l.row} onClick={() => act(l, "Pending Review")}>Undo</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <LeadModal lead={open} busy={busyRow === open.row} error={error} onClose={() => setOpenRow(null)} onAct={(s) => act(open, s, true)} />}
    </>
  );
}

function Fld({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  if (!children) return null;
  return <div className={`mf${full ? " full" : ""}`}><div className="mf-lbl">{label}</div><div className="mf-val">{children}</div></div>;
}

function LeadModal({ lead, busy, error, onClose, onAct }: { lead: Lead; busy: boolean; error: string; onClose: () => void; onAct: (s: LeadStatus) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus(); };
  }, [onClose]);
  const site = lead.website ? (lead.website.startsWith("http") ? lead.website : `https://${lead.website}`) : "";
  const wp = lead.webPresence.toLowerCase();
  const hasPitch = lead.webPresence || lead.gaps || lead.competitors || lead.services || lead.pitch;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="lead-title" className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="m-id">{lead.id}</div>
          <div className="m-info">
            <h3 id="lead-title">{lead.company}</h3>
            <div className="m-meta">{ratingBadge(lead.rating)}<span>{lead.location}</span></div>
          </div>
          <button className="m-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="m-fields">
          <Fld label="Section">{lead.section}</Fld>
          <Fld label="Lead Score">{lead.score ? <span className="m-score">{lead.score}/20</span> : ""}</Fld>
          <Fld label="Decision Maker">{lead.decisionMaker}</Fld>
          <Fld label="Title">{lead.title}</Fld>
          <Fld label="Location">{lead.location}</Fld>
          <Fld label="Est. Revenue">{lead.revenue}</Fld>
          <Fld label="Contact" full>{lead.contact}</Fld>
          <Fld label="Key Buying Signal" full>{lead.signal}</Fld>
          <Fld label="Website" full>{site && <a href={site} target="_blank" rel="noopener noreferrer">{lead.website}</a>}</Fld>
        </div>
        {hasPitch && (
          <div className="m-pitch">
            <div className="m-pitch-hdr">Pitch Intelligence</div>
            <div className="pf-grid">
              <div className="pf"><div className="pf-lbl">Web Presence</div><div className={`pf-val ${wp === "strong" ? "wp-strong" : wp === "moderate" ? "wp-moderate" : "wp-weak"}`}>{lead.webPresence}</div></div>
              <div className="pf"><div className="pf-lbl">Cowley Services Match</div><div>{lead.services.split("·").map((s) => s.trim()).filter(Boolean).map((s) => <span key={s} className="svc-pill">{s}</span>)}</div></div>
              <div className="pf full"><div className="pf-lbl">Key Website Gaps</div><div className="pf-val">{lead.gaps}</div></div>
              <div className="pf full"><div className="pf-lbl">Top Competitors</div><div className="pf-val">{lead.competitors}</div></div>
              <div className="pf full"><div className="pf-lbl">Recommended Pitch Angle</div><div className="pf-val">{lead.pitch}</div></div>
            </div>
          </div>
        )}
        {error && <p role="alert" style={{ color: "#c5473d", fontWeight: 700, padding: "10px 18px 0", margin: 0 }}>{error}</p>}
        <div className="m-actions">
          <button className="m-btn approve" disabled={busy} onClick={() => onAct("Approved")}>✓ Approve</button>
          <button className="m-btn reject" disabled={busy} onClick={() => onAct("Not Approved")}>✕ Not Approved</button>
        </div>
      </div>
    </div>
  );
}
