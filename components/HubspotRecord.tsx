"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RecordDetail } from "@/lib/hubspot";
import { CARDS, type CardDef, type FieldDef, type ObjType } from "@/lib/hubspotFields";
import { initials, recordName } from "@/lib/hubspotUi";
import { sendJson } from "@/lib/sendJson";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

const fmtDateTime = (s: string | null) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

export default function HubspotRecord({ type, id }: { type: ObjType; id: string }) {
  const [rec, setRec] = useState<RecordDetail | null>(null);
  const [error, setError] = useState("");
  const [tries, setTries] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    fetch(`/api/hubspot/record?type=${type}&id=${id}`, { signal: ctrl.signal, cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.success) throw new Error(j?.error || "Unable to load this record.");
        setRec(j.data);
        setError("");
      })
      .catch((e: Error) => setError(e.name === "AbortError" ? "Loading took too long." : e.message))
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [type, id, tries]);

  const list = (
    <Link className="hs-back" href="/hubspot">‹ {type === "contact" ? "Contacts" : "Companies"}</Link>
  );
  if (error) return <><p>{list}</p><ErrorState message={`Unable to load this record. ${error}`} onRetry={() => setTries((n) => n + 1)} /></>;
  if (!rec) return <><p>{list}</p><LoadingState label="Loading from HubSpot…" cards={3} /></>;

  const p = rec.properties;
  const name = recordName(type, p);
  const sub = type === "contact" ? [p.jobtitle, p.company].filter(Boolean).join(" at ") : p.domain ?? "";
  const merge = (changed: Record<string, string>) => setRec({ ...rec, properties: { ...rec.properties, ...changed } });
  const cards = CARDS[type];

  return (
    <div className="hs-record">
      <div>
        <div className="hs-card">
          <div className="hs-card-head">
            {list}
            <a className="hs-back" href={rec.url} target="_blank" rel="noopener noreferrer">Open in HubSpot ↗</a>
          </div>
          <div className="hs-card-body" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="hs-avatar big" aria-hidden>{initials(name)}</span>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "var(--gray900)", overflowWrap: "anywhere" }}>{name}</h2>
              {sub && <div className="hs-label" style={{ marginTop: 3 }}>{sub}</div>}
            </div>
          </div>
        </div>
        {cards.filter((c) => c.column === "left").map((c) => <Card key={c.id} card={c} type={type} rec={rec} onSaved={merge} />)}
      </div>

      <div>
        <div className="hs-recordtabs" role="tablist">
          <span className="hs-rtab on" role="tab" aria-selected="true">About</span>
          <a className="hs-rtab" role="tab" aria-selected="false" href={rec.url} target="_blank" rel="noopener noreferrer" title="Activity history is shown in HubSpot">Activities ↗</a>
        </div>
        {cards.filter((c) => c.column === "center").map((c) => <Card key={c.id} card={c} type={type} rec={rec} onSaved={merge} wide />)}
      </div>

      <div>
        <div className="hs-card">
          <div className="hs-card-head"><h3>{rec.related.kind === "company" ? "Companies" : "Contacts"} ({rec.related.total})</h3></div>
          <div className="hs-card-body">
            {rec.related.items.length === 0 && <div className="hs-value empty">No associated {rec.related.kind === "company" ? "companies" : "contacts"}.</div>}
            {rec.related.items.map((r) => (
              <div key={r.id} className="hs-person">
                <span className="hs-avatar" aria-hidden>{initials(r.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <Link className="hs-link" href={`/hubspot/${rec.related.kind === "company" ? "companies" : "contacts"}/${r.id}`}>{r.name}</Link>
                  {r.sub && <div className="hs-label" style={{ margin: 0, overflowWrap: "anywhere" }}>{r.sub}</div>}
                </div>
              </div>
            ))}
            {rec.related.total > rec.related.items.length && <a className="hs-back" href={rec.url} target="_blank" rel="noopener noreferrer">View all in HubSpot ↗</a>}
          </div>
        </div>
      </div>
    </div>
  );
}

function show(f: FieldDef, p: RecordDetail["properties"], options: RecordDetail["options"]): string {
  const v = p[f.key] ?? "";
  if (!v) return "";
  if (f.kind === "date") return fmtDateTime(v);
  if (f.key === "dashboard_approval_status") return v === "approved" ? "Approved" : v === "not_approved" ? "Not Approved" : v;
  if (f.kind === "enum") return options[f.key]?.find((o) => o.value === v)?.label ?? v;
  return v;
}

/** One HubSpot-style card. Editing happens per card, so it is always clear which section is being changed. */
function Card({ card, type, rec, onSaved, wide }: { card: CardDef; type: ObjType; rec: RecordDetail; onSaved: (c: Record<string, string>) => void; wide?: boolean }) {
  const editable = card.fields.filter((f) => f.kind !== "date" && f.kind !== "readonly");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  function start() {
    setDraft(Object.fromEntries(editable.map((f) => [f.key, rec.properties[f.key] ?? ""])));
    setMsg(null);
    setEditing(true);
  }
  async function save() {
    const changed = Object.fromEntries(Object.entries(draft).filter(([k, v]) => v.trim() !== (rec.properties[k] ?? "")));
    if (!Object.keys(changed).length) { setEditing(false); return; }
    setBusy(true);
    setMsg(null);
    try {
      await sendJson("/api/hubspot", "PATCH", { type, id: rec.id, properties: changed });
      onSaved(Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.trim()])));
      setEditing(false);
      setMsg({ ok: true, t: `${card.title} saved to HubSpot.` });
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`hs-card${editing ? " editing" : ""}`} aria-label={card.title}>
      <div className="hs-card-head">
        <h3>{card.title}</h3>
        {!editing && <button className="hs-edit-btn" onClick={start} aria-label={`Edit ${card.title}`}>✎ Edit</button>}
      </div>
      {editing && <div className="hs-edit-banner">Editing “{card.title}” — changes here are saved to HubSpot when you click Save.</div>}
      <div className="hs-card-body">
        <div className={wide ? "hs-grid3" : undefined}>
          {card.fields.map((f) => {
            const isEditable = editing && editable.includes(f);
            const v = show(f, rec.properties, rec.options);
            return (
              <div key={f.key} className="hs-field">
                <label className="hs-label" htmlFor={`f-${card.id}-${f.key}`} style={{ display: "block" }}>{f.label}</label>
                {isEditable ? (
                  f.kind === "enum" ? (
                    <select id={`f-${card.id}-${f.key}`} className="hs-input" value={draft[f.key] ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}>
                      <option value="">No value</option>
                      {(rec.options[f.key] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input id={`f-${card.id}-${f.key}`} className="hs-input" maxLength={200} value={draft[f.key] ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} type={f.kind === "email" ? "email" : f.kind === "phone" ? "tel" : "text"} />
                  )
                ) : (
                  <div className={`hs-value${v ? "" : " empty"}`}>{v || "--"}</div>
                )}
              </div>
            );
          })}
        </div>
        {editing && (
          <div className="hs-actions">
            <button className="hs-save" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save to HubSpot"}</button>
            <button className="sel-btn" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        )}
        {msg && <div role={msg.ok ? "status" : "alert"} className={`save-msg ${msg.ok ? "ok" : "err"}`} style={{ marginTop: 8 }}>{msg.t}</div>}
      </div>
    </section>
  );
}
