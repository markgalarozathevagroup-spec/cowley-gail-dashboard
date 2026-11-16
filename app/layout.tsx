import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Gail's Dashboard — Cowley Associates",
  description: "Executive dashboard for Cowley Associates",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <Shell>{children}</Shell>
        </Suspense>
      </body>
    </html>
  );
}
