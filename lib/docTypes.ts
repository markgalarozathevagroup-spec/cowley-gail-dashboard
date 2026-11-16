export interface DocItem {
  row: number;
  title: string;
  purpose: string;
  link: string;
  status: "Pending Review" | "Approved" | "Not Approved";
}

export const GAIL_STATUSES = ["Needs Gail", "In Review", "Done", "Not Needed"] as const;
export type GailStatus = (typeof GAIL_STATUSES)[number];

export interface GailItem {
  row: number;
  date: string;
  source: string;
  item: string;
  todo: string;
  status: GailStatus;
  notes: string;
}

export const isHttpUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);
