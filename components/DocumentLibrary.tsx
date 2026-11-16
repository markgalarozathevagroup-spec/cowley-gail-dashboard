"use client";

import { useState } from "react";
import type { DocItem } from "@/lib/docTypes";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leadTypes";
import { fmtInt } from "@/lib/formatters";
import { sendJson } from "@/lib/sendJson";
import { useApi } from "@/lib/useApi";
import ErrorState from "./ErrorState";
import Header from "./Header";
import LoadingState from "./LoadingState";

type Filter = LeadStatus | "All";
const input = "w-full rounded-lg border-2 border-line bg-white p-3 text-base text-ink";

export default function DocumentLibrary() {
  const { state, retry } = useApi<{ items: DocItem[] }>("/api/documents", "Document Library");
  return (
    <>
      <Header title="Document Library" subtitle="Documents for Gail to review" />
      {state.status === "loading" && <LoadingState label="Loading Document Library…" />}
      {state.status === "error" && <ErrorState message={`Unable to load the Document Library. ${state.error}`} onRetry={retry} />}
      {state.status === "ready" && <Body initial={state.data.items} />}
    </>
  );
}

function Body({ initial }: { initial: DocItem[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("All");
  const [adding, setAdding] = useState(false);
  const count = (s: LeadStatus) => items.filter((i) => i.status === s).length;
  const visible = items.filter((i) => filter === "All" || i.status === filter);
  const patchItem = (row: number, p: Partial<DocItem>) => setItems((xs) => xs.map((x) => (x.row === row ? { ...x, ...p } : x)));

  const cards: { label: string; value: number; f: Filter }[] = [
    { label: "Total Documents", value: items.length, f: "All" },
    { label: "Pending Review", value: count("Pending Review"), f: "Pending Review" },
    { label: "Approved", value: count("Approved"), f: "Approved" },
    { label: "Not Approved", value: count("Not Approved"), f: "Not Approved" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            aria-pressed={filter === c.f}
            onClick={() => setFilter(c.f)}
            className={`rounded-xl border-2 bg-white p-5 text-left hover:border-teal ${filter === c.f ? "border-navy" : "border-line"}`}
          >
            <span className="block text-base font-semibold text-muted">{c.label}</span>
            <span className="mt-1 block text-3xl font-bold text-navy">{fmtInt(c.value)}</span>
          </button>
        ))}
      </div>

      <div>
        <button onClick={() => setAdding((a) => !a)} className="rounded-lg bg-navy px-5 py-3 text-base font-bold text-white hover:opacity-90">
          {adding ? "Close" : "+ Add Document"}
        </button>
        {adding && <AddForm onAdded={(d) => { setItems((xs) => [...xs, d]); setAdding(false); }} />}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-base">
          <thead className="bg-surface text-sm uppercase tracking-wide text-muted">
            <tr>
              <th className="p-4">Title</th>
              <th className="p-4">Purpose</th>
              <th className="p-4">Document Link</th>
              <th className="p-4">Status</th>
              <th className="p-4"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={5} className="p-6 text-muted">No documents match this filter.</td></tr>}
            {visible.map((d) => <Row key={d.row} doc={d} onChange={(p) => patchItem(d.row, p)} />)}
          </tbody>
        </table>
      </div>
    </div>
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
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border-2 border-line bg-white p-5">
      <label className="block text-base font-semibold">Title<input required className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="block text-base font-semibold">Purpose<textarea rows={3} className={input} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></label>
      <label className="block text-base font-semibold">Document link<input type="url" placeholder="https://" className={input} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></label>
      {err && <p role="alert" className="font-semibold text-bad">{err}</p>}
      <button disabled={busy} className="rounded-lg bg-good px-5 py-3 text-base font-bold text-white disabled:opacity-50">{busy ? "Adding…" : "Add to library"}</button>
    </form>
  );
}

function Row({ doc, onChange }: { doc: DocItem; onChange: (p: Partial<DocItem>) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: doc.title, purpose: doc.purpose, link: doc.link });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true);
    setErr("");
    try {
      let title = doc.title; // guard value follows the sheet as each field is saved
      for (const field of ["title", "purpose", "link"] as const) {
        if (draft[field] === doc[field]) continue;
        await sendJson("/api/documents", "PATCH", { row: doc.row, expectedTitle: title, field, value: draft[field] });
        if (field === "title") title = draft.title;
        onChange({ [field]: draft[field].trim() });
      }
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: LeadStatus) {
    setErr("");
    try {
      await sendJson("/api/documents", "PATCH", { row: doc.row, expectedTitle: doc.title, field: "status", value: status });
      onChange({ status });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <tr className="border-t border-line align-top">
      <td className="p-4 min-w-48">
        {editing ? <input aria-label="Title" className={input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /> : <span className="font-bold text-navy">{doc.title}</span>}
      </td>
      <td className="p-4 min-w-64 max-w-md">
        {editing ? <textarea aria-label="Purpose" rows={4} className={input} value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} /> : doc.purpose}
      </td>
      <td className="p-4 min-w-40">
        {editing ? (
          <input aria-label="Document link" className={input} value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} />
        ) : doc.link ? (
          <a href={doc.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy underline">Open document</a>
        ) : <span className="text-muted">No link</span>}
      </td>
      <td className="p-4">
        <select
          aria-label={`Status of ${doc.title}`}
          value={doc.status}
          onChange={(e) => setStatus(e.target.value as LeadStatus)}
          className="rounded-lg border-2 border-line bg-white px-3 py-2.5 text-base font-semibold text-ink"
        >
          {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </td>
      <td className="p-4 whitespace-nowrap">
        {editing ? (
          <div className="flex flex-col gap-2">
            <button disabled={busy} onClick={save} className="rounded-lg bg-good px-4 py-2 text-base font-bold text-white disabled:opacity-50">Save</button>
            <button disabled={busy} onClick={() => { setEditing(false); setErr(""); setDraft({ title: doc.title, purpose: doc.purpose, link: doc.link }); }} className="rounded-lg border-2 border-line px-4 py-2 text-base font-semibold">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="rounded-lg border-2 border-navy px-4 py-2 text-base font-semibold text-navy hover:bg-surface">Edit</button>
        )}
        {err && <p role="alert" className="mt-2 max-w-48 whitespace-normal text-sm font-semibold text-bad">{err}</p>}
      </td>
    </tr>
  );
}
