"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { NAV } from "@/lib/constants";

const readDark = () => {
  try { return localStorage.getItem("gd-theme") === "dark"; } catch { return false; }
};
const subscribe = (cb: () => void) => {
  window.addEventListener("gd-theme", cb);
  return () => window.removeEventListener("gd-theme", cb);
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const dark = useSyncExternalStore(subscribe, readDark, () => false);

  useEffect(() => {
    document.body.classList.toggle("dark", dark);
  }, [dark]);

  function choose(d: boolean) {
    try { localStorage.setItem("gd-theme", d ? "dark" : "light"); } catch {}
    window.dispatchEvent(new Event("gd-theme"));
  }

  return (
    <aside className="sidebar">
      <div className="logo">
        <Image src="/cowley-logo.png" alt="Cowley Associates" width={363} height={120} priority style={{ width: "100%", maxWidth: 180, height: "auto" }} />
        <span className="logo-sub">Gail&apos;s Dashboard</span>
      </div>
      <nav className="nav" aria-label="Main">
        {NAV.map((g) => (
          <div key={g.group} style={{ display: "contents" }}>
            <div className="lbl" style={{ marginTop: g.group === "Workspace" ? 0 : 8 }}>{g.group}</div>
            {g.items.map((it) => {
              const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
              return (
                <Link key={it.href} href={it.href} className={`navitem${active ? " on" : ""}`} aria-current={active ? "page" : undefined}>
                  <span className="ic" aria-hidden>{it.icon}</span>
                  {it.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <button className="navitem" style={{ margin: "0 8px 4px", width: "auto" }} onClick={async () => { await fetch("/api/logout", { method: "POST" }); router.replace("/login");
          router.refresh(); }}>
        <span className="ic" aria-hidden>🔒</span>Sign out
      </button>
      <div className="theme-toggle">
        <button className={`thmbtn${!dark ? " on" : ""}`} onClick={() => choose(false)}>☀️ Light</button>
        <button className={`thmbtn${dark ? " on" : ""}`} onClick={() => choose(true)}>🌙 Dark</button>
      </div>
    </aside>
  );
}
