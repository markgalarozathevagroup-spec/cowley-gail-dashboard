"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Shell({ children }: { children: React.ReactNode }) {
  if (usePathname() === "/login") return <>{children}</>;
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar />
        <div className="scroll">{children}</div>
        <footer className="foot">
          <span>Live Google Sheets</span>
          <span className="spacer" />
          <span>Cowley Associates · Gail&apos;s Dashboard</span>
        </footer>
      </main>
    </div>
  );
}
