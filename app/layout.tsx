import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Gail's Dashboard — Cowley Associates",
  description: "Executive dashboard for Cowley Associates",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen lg:flex">
        <Sidebar />
        <main className="flex-1 min-w-0 px-5 py-6 lg:px-10 lg:py-8">{children}</main>
      </body>
    </html>
  );
}
