"use client";

import { usePathname } from "next/navigation";
import { PAGES } from "@/lib/constants";

export default function Topbar() {
  const pathname = usePathname();
  const key = Object.keys(PAGES).find((k) => (k === "/" ? pathname === "/" : pathname.startsWith(k))) ?? "/";
  const p = PAGES[key];
  return (
    <header className="topbar">
      <div>
        <h1>{p.title}</h1>
        <div className="hint">{p.hint}</div>
      </div>
      <span className="spacer" />
      <span className="hint">🟢 Live</span>
    </header>
  );
}
