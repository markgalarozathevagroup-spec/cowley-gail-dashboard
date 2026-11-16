"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(j?.error || "Unable to sign in.");
      router.replace("/");
      router.refresh();
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <form onSubmit={submit} className="panel" style={{ width: "min(420px, 100%)", padding: 28 }}>
        <Image src="/cowley-logo.png" alt="Cowley Associates" width={363} height={120} priority style={{ width: 180, height: "auto" }} />
        <h1 style={{ fontSize: 20, margin: "18px 0 4px", color: "var(--navy)" }}>Gail&apos;s Dashboard</h1>
        <p className="hint" style={{ marginBottom: 16, fontSize: 14 }}>Please enter the dashboard password.</p>
        <label style={{ fontWeight: 700, fontSize: 14 }}>
          Password
          <input type="password" autoFocus required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="search-wide" style={{ marginTop: 6, fontSize: 16, padding: "12px 14px" }} />
        </label>
        {err && <p role="alert" style={{ color: "var(--bad)", fontWeight: 700, margin: "6px 0 10px" }}>{err}</p>}
        <button className="btn" disabled={busy} style={{ width: "100%", padding: "13px 16px", fontSize: 16, marginTop: 8 }}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
