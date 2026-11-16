"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LEAD_SEGMENTS, LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/leadTypes";
import { fmtInt } from "@/lib/formatters";
import { useApi } from "@/lib/useApi";
import ErrorState from "./ErrorState";
import Header from "./Header";
import LoadingState from "./LoadingState";

type StatusFilter = LeadStatus | "All Statuses";

const selectCls = "mt-1 block rounded-lg border-2 border-line bg-white px-3 py-2.5 text-base text-ink";

const ratingCls = (r: string) =>
  r.toLowerCase() === "hot" ? "bg-coral text-white" : r.toLowerCase() === "warm" ? "bg-warning text-ink" : "bg-line text-ink";

const statusCls = (s: LeadStatus) =>
  s === "Approved" ? "bg-good text-white" : s === "Not Approved" ? "bg-bad text-white" : "bg-surface text-ink border border-line";

export default function Leads() {
  const { state, retry } = useApi<{ leads: Lead[] }>("/api/leads", "Leads");
  return (
    <>
      <Header title="Leads" subtitle="Review prospects and approve or decline each one" />
      {state.status === "loading" && <LoadingState label="Loading Leads…" />}
      {state.status === "error" && <ErrorState message={`Unable to load Leads. ${state.error}`} onRetry={retry} />}
      {state.status === "ready" && <Body initial={state.data.leads} />}
    </>
  );
}

function Body({ initial }: { initial: Lead[] }) {
  const [leads, setLeads] = useState(initial);
  const [segment, setSegment] = useState("All Segments");
  const [status, setStatus] = useState<StatusFilter>("Pending Review");
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const inSegment = useMemo(
    () => leads.filter((l) => segment === "All Segments" || l.section.toLowerCase() === segment.toLowerCase()),
    [leads, segment],
  );
  const count = (s: LeadStatus) => inSegment.filter((l) => l.status === s).length;
  const visible = inSegment.filter((l) => status === "All Statuses" || l.status === status);
  const open = leads.find((l) => l.row === openRow) ?? null;

  async function setLeadStatus(lead: Lead, next: LeadStatus) {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row: lead.row, leadId: lead.id, status: next }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(j?.error || "Unable to save.");
      setLeads((ls) => ls.map((l) => (l.row === lead.row ? { ...l, status: next } : l)));
      setOpenRow(null);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const cards: { label: string; value: number; filter?: StatusFilter }[] = [
    { label: "Pending Review", value: count("Pending Review"), filter: "Pending Review" },
    { label: "Hot Leads", value: inSegment.filter((l) => l.rating.toLowerCase() === "hot").length },
    { label: "Approved", value: count("Approved"), filter: "Approved" },
    { label: "Not Approved", value: count("Not Approved"), filter: "Not Approved" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const inner = (
            <>
              <span className="block text-base font-semibold text-muted">{c.label}</span>
              <span className="mt-1 block text-3xl font-bold text-navy">{fmtInt(c.value)}</span>
            </>
          );
          return c.filter ? (
            <button
              key={c.label}
              onClick={() => setStatus(c.filter!)}
              aria-pressed={status === c.filter}
              className={`rounded-xl border-2 bg-white p-5 text-left ${status === c.filter ? "border-navy" : "border-line"} hover:border-teal`}
            >
              {inner}
            </button>
          ) : (
            <div key={c.label} className="rounded-xl border-2 border-line bg-white p-5">{inner}</div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 rounded-xl border border-line bg-white p-5">
        <label className="text-base font-semibold">
          Segment
          <select className={selectCls} value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option>All Segments</option>
            {LEAD_SEGMENTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-base font-semibold">
          Status
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
            <option>All Statuses</option>
          </select>
        </label>
        <p className="self-end pb-3 text-base text-muted">Showing {fmtInt(visible.length)} of {fmtInt(leads.length)} leads</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-base">
          <thead className="bg-surface text-sm uppercase tracking-wide text-muted">
            <tr>
              <th className="p-4">Company</th>
              <th className="p-4">Segment</th>
              <th className="p-4">Decision Maker</th>
              <th className="p-4 text-right">Score</th>
              <th className="p-4">Rating</th>
              <th className="p-4">Buying Signal</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-muted">No leads match these filters.</td></tr>
            )}
            {visible.map((l) => (
              <tr key={l.row} className="border-t border-line align-top hover:bg-surface/60">
                <td className="p-4">
                  <button onClick={() => { setSaveError(""); setOpenRow(l.row); }} className="text-left font-bold text-navy underline decoration-teal underline-offset-4">
                    {l.company}
                  </button>
                  <span className="block text-sm text-muted">{l.location}</span>
                </td>
                <td className="p-4">{l.section}</td>
                <td className="p-4">{l.decisionMaker}<span className="block text-sm text-muted">{l.title}</span></td>
                <td className="p-4 text-right font-semibold">{l.score || "—"}</td>
                <td className="p-4"><span className={`rounded-full px-3 py-1 text-sm font-bold ${ratingCls(l.rating)}`}>{l.rating || "—"}</span></td>
                <td className="p-4 max-w-sm">{l.signal}</td>
                <td className="p-4"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold ${statusCls(l.status)}`}>{l.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <LeadModal lead={open} saving={saving} error={saveError} onClose={() => setOpenRow(null)} onSet={(s) => setLeadStatus(open, s)} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div>
      <dt className="text-sm font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-base text-ink">{children}</dd>
    </div>
  );
}

function LeadModal({ lead, saving, error, onClose, onSet }: {
  lead: Lead; saving: boolean; error: string; onClose: () => void; onSet: (s: LeadStatus) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus(); };
  }, [onClose]);

  const site = lead.website ? (lead.website.startsWith("http") ? lead.website : `https://${lead.website}`) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-white/80 p-4 sm:p-8" onClick={onClose} style={{ colorScheme: "light" }}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl border-2 border-navy bg-white p-6 text-ink shadow-xl outline-none sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-muted">Lead {lead.id}</p>
            <h2 id="lead-title" className="text-2xl font-bold text-navy">{lead.company}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${ratingCls(lead.rating)}`}>{lead.rating}</span>
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${statusCls(lead.status)}`}>{lead.status}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg border-2 border-line px-4 py-2 text-base font-semibold hover:bg-surface">Close</button>
        </div>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Section">{lead.section}</Field>
          <Field label="Lead Score">{lead.score ? `${lead.score} / 20` : ""}</Field>
          <Field label="Decision Maker">{lead.decisionMaker}</Field>
          <Field label="Title">{lead.title}</Field>
          <Field label="Location">{lead.location}</Field>
          <Field label="Estimated Revenue">{lead.revenue}</Field>
          <Field label="Contact">{lead.contact}</Field>
          <Field label="Website">{site && <a href={site} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy underline">{lead.website}</a>}</Field>
          <Field label="Web Presence">{lead.webPresence}</Field>
          <Field label="Cowley Services Match">{lead.services}</Field>
        </dl>
        <dl className="mt-5 space-y-5">
          <Field label="Buying Signal">{lead.signal}</Field>
          <Field label="Website Gaps">{lead.gaps}</Field>
          <Field label="Competitors">{lead.competitors}</Field>
          <Field label="Recommended Pitch Angle">{lead.pitch}</Field>
        </dl>

        {error && <p role="alert" className="mt-5 font-semibold text-bad">{error}</p>}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            disabled={saving}
            onClick={() => onSet("Approved")}
            className="rounded-xl bg-good px-6 py-5 text-xl font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            ✓ Approve
          </button>
          <button
            disabled={saving}
            onClick={() => onSet("Not Approved")}
            className="rounded-xl bg-bad px-6 py-5 text-xl font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            ✕ Not Approved
          </button>
        </div>
        {saving && <p className="mt-3 text-base text-muted">Saving to Google Sheets…</p>}
      </div>
    </div>
  );
}
