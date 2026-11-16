export const SHEET_TABS = {
  mailchimp: "Mailchimp",
  leads: "Leads",
  hubspot: "Hubspot",
  documents: "Documents",
  gailApproval: "Gail Approval",
  calendar: "Campaign Calendar",
  sales: "Sales by Customer Summary",
  functionFox: "Function Fox Hours",
} as const;

export const NAV = [
  {
    group: "Workspace",
    items: [
      { label: "Overview", href: "/", icon: "home" },
      { label: "Mailchimp", href: "/mailchimp", icon: "mail" },
      { label: "Hubspot", href: "/hubspot", icon: "users" },
      { label: "Sales & Hours", href: "/sales-hours", icon: "dollar" },
    ],
  },
  {
    group: "Outreach",
    items: [
      { label: "Leads", href: "/leads", icon: "target" },
      { label: "Campaign Calendar", href: "/campaign-calendar", icon: "calendar" },
    ],
  },
  {
    group: "Documents",
    items: [{ label: "Document Library", href: "/documents", icon: "file" },
      { label: "Gail Approval", href: "/gail-approval", icon: "check" },
    ],
  },
] as const;

export type IconName = (typeof NAV)[number]["items"][number]["icon"];

/** Campaigns whose names contain these words never count as "best campaign". */
/** A campaign must reach at least this many people to be called a "best" campaign. */
export const MIN_BEST_CAMPAIGN_SENT = 100;

export const EXCLUDED_CAMPAIGN_WORDS = ["preview", "test", "resend", "admin test"];

export interface Benchmark {
  industry: string;
  label: string;
  open: number;
  click: number;
  unsub: number;
}

export const BENCHMARKS: Benchmark[] = [
  { industry: "B2B Professional Services", label: "Benchmark: Business + Finance", open: 31.35, click: 2.78, unsub: 0.15 },
  { industry: "Healthcare", label: "External Healthcare Industry Benchmark", open: 43.95, click: 3.08, unsub: 0.21 },
  { industry: "Non-profit", label: "Mailchimp Non-Profits", open: 40.04, click: 3.27, unsub: 0.18 },
  { industry: "All Users", label: "Mailchimp All Users", open: 35.63, click: 2.62, unsub: 0.22 },
];

export const STANDARD_RATE = 150; // $/hr
export const INTERNAL_CLIENT_PATTERN = /^1000-?\s*cowley associates/i;
/** FunctionFox client names that can't be matched to QuickBooks automatically (normalised FF name -> QB name). */
export const CLIENT_ALIASES: Record<string, string> = {
  yftactair: "Young and Franklin - Tactair",
  researchandmarketingstrategies: "RMS",
};
/** Dollar size at which a billing gap is called out as "large". */
export const LARGE_GAP = 5000;
