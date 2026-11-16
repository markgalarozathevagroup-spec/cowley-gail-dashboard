/** Parse "20.34%", 0.2034 or 20.34 into percentage points (20.34). */
export function parsePercent(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v <= 1 ? v * 100 : v;
  const s = String(v).trim();
  const n = parseFloat(s.replace(/[%,\s]/g, ""));
  if (Number.isNaN(n)) return 0;
  if (s.includes("%")) return n;
  return n <= 1 ? n * 100 : n;
}

export function parseNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** Normalise "2026-10-29" or "10/29/2026" to ISO "YYYY-MM-DD"; "" if unparseable. */
export function toIsoDate(v: unknown): string {
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return "";
}

export const fmtPct = (n: number) => `${n.toFixed(2)}%`;
export const fmtInt = (n: number) => n.toLocaleString("en-US");

export function fmtDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const fmtMoney = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtHours = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
