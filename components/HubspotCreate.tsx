"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ObjType } from "@/lib/hubspotFields";

type F = { key: string; label: string; kind?: "enum" | "email" | "tel"; required?: boolean };

const FIELDS: Record<ObjType, F[]> = {
  contact: [
    { key: "firstname", label: "First name" },
    { key: "lastname", label: "Last name" },
    { key: "email", label: "Email", kind: "email" },
    { key: "jobtitle", label: "Job title" },
    { key: "company", label: "Company name" },
    { key: "phone", label: "Phone number", kind: "tel" },
    { key: "city", label: "City" },
    { key: "state", label: "State/Region" },
    { key: "lifecyclestage", label: "Lifecycle stage", kind: "enum" },
  ],
  company: [
    { key: "name", label: "Company name" },
    { key: "domain", label: "Company domain name" },
    { key: "phone", label: "Phone number", kind: "tel" },
    { key: "city", label: "City" },
    { key: "state", label: "State/Region" },
    { key: "industry", label: "Industry", kind: "enum" },
    { key: "lifecyclestage", label: "Lifecycle stage", kind: "enum" },
  ],
};

export default function HubspotCreate({ type, options, onClose }: { type: ObjType; options: Record<string, { value: string; label: string }[]>; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Record<string, string>>({ lifecyclestage: "lead" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [existing, setExisting] = useState("");
  const noun = type === "contact" ? "contact" : "company";

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus(); };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setExisting("");
    try {
      const res = await fetch("/api/hubspot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, properties: draft }) });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) {
        if (j?.existingId) setExisting(j.existingId);
        throw new Error(j?.error || "Unable to create the record.");
      }
      router.push(`/hubspot/${type === "contact" ? "contacts" : "companies"}/${j.data.id}`);
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="create-title" className="modal-card" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit}>
          <div className="modal-head">
            <div className="m-info"><h3 id="create-title">Create {noun}</h3><div className="m-meta">This adds a new {noun} to HubSpot.</div></div>
            <button type="button" className="m-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="m-fields">
            {FIELDS[type].map((f) => (
              <div key={f.key} className="mf">
                <label className="mf-lbl" htmlFor={`c-${f.key}`} style={{ display: "block" }}>{f.label}</label>
                {f.kind === "enum" ? (
                  <select id={`c-${f.key}`} className="hs-input" value={draft[f.key] ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}>
                    <option value="">No value</option>
                    {(options[f.key] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input id={`c-${f.key}`} className="hs-input" maxLength={200} type={f.kind === "email" ? "email" : f.kind === "tel" ? "tel" : "text"} value={draft[f.key] ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 18px 0", fontSize: 13, color: "#5f6d73" }}>
            {type === "contact" ? "Enter an email address or a name." : "Enter a company name or a domain."}
          </div>
          {err && (
            <p role="alert" style={{ color: "#c5473d", fontWeight: 700, padding: "10px 18px 0", margin: 0 }}>
              {err}{" "}
              {existing && <Link className="hs-link" href={`/hubspot/${type === "contact" ? "contacts" : "companies"}/${existing}`}>Open the existing {noun}</Link>}
            </p>
          )}
          <div className="m-actions" style={{ position: "static" }}>
            <button className="m-btn approve" disabled={busy}>{busy ? "Creating…" : `Create ${noun}`}</button>
            <button type="button" className="m-btn" style={{ background: "#fff", border: "2px solid #cbdadd", color: "#425b76" }} disabled={busy} onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
