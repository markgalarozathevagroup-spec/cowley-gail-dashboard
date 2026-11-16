export const LEAD_STATUSES = ["Pending Review", "Approved", "Not Approved"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SEGMENTS = ["B2B Professional Services", "Healthcare", "Non-profit"] as const;

export interface Lead {
  row: number; // 1-based sheet row
  id: string;
  section: string;
  company: string;
  location: string;
  decisionMaker: string;
  title: string;
  contact: string;
  website: string;
  revenue: string;
  score: number;
  rating: string;
  signal: string;
  status: LeadStatus;
  webPresence: string;
  gaps: string;
  competitors: string;
  services: string;
  pitch: string;
}

/** Sheet values like "approved" / "rejected" / "" map onto the three dashboard statuses. */
export function normalizeStatus(v: unknown): LeadStatus {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "rejected" || s === "not approved" || s === "not_approved") return "Not Approved";
  return "Pending Review";
}
