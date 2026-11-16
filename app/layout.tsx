import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export const metadata: Metadata = {
  title: "Gail's Dashboard — Cowley Associates",
  description: "Executive dashboard for Cowley Associates",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
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
      </body>
    </html>
  );
}
