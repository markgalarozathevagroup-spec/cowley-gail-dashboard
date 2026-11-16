"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, type IconName } from "@/lib/constants";

const PATHS: Record<IconName, string> = {
  home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  mail: "M3 5h18v14H3zM3 5l9 8 9-8",
  users: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0",
  dollar: "M12 2v20M17 6.5C16 5 14 4.5 12 4.5c-2.5 0-4.5 1.2-4.5 3.3 0 5 9.500 2.200 9.500 7.400 0 2-2 3.300-5 3.300-2.200 0-4-.7-5-2.200",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.500l3 3 5-6",
  file: "M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8",
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="bg-white border-b lg:border-b-0 lg:border-r border-line lg:w-72 lg:min-h-screen lg:sticky lg:top-0 lg:self-start shrink-0">
      <div className="px-6 py-5">
        <Image src="/cowley-logo.png" alt="Cowley Associates" width={363} height={120} className="h-14 w-auto" priority />
      </div>
      <nav aria-label="Main" className="px-3 pb-4 flex lg:block flex-wrap gap-x-4">
        {NAV.map((g) => (
          <div key={g.group} className="mb-2 lg:mb-5">
            <p className="px-3 py-1 text-xs font-bold tracking-widest uppercase text-muted">{g.group}</p>
            <ul>
              {g.items.map((it) => {
                const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-semibold ${
                        active ? "bg-navy text-white" : "text-ink hover:bg-surface"
                      }`}
                    >
                      <Icon name={it.icon} />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
