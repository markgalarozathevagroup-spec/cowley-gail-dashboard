import type { ObjType } from "./hubspotFields";

export const recordName = (type: ObjType, p: Record<string, string | null>) =>
  type === "contact" ? [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "(no name)" : p.name || p.domain || "(no name)";

export const initials = (s: string) =>
  s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
