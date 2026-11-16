import { readTab } from "@/lib/googleSheets";
import { SHEET_TABS } from "@/lib/constants";
import { ok, fail } from "@/lib/api";
import { parseNumber, parsePercent, toIsoDate } from "@/lib/formatters";

export interface Campaign {
  name: string;
  date: string; // ISO
  emailsSent: number;
  openRate: number; // percentage points
  clickRate: number;
  uniqueOpens: number;
  clicks: number;
}

export interface MailchimpData {
  audience: string;
  subscribers: number;
  unsubscribes: number;
  cleaned: number;
  campaignsSent: number;
  avgOpenRate: number;
  avgClickRate: number;
  lastCampaign: string;
  trackingSince: string;
  campaigns: Campaign[];
}

export async function GET() {
  try {
    const rows = await readTab(SHEET_TABS.mailchimp);
    const metrics = new Map<string, string>();
    let i = 0;
    for (; i < rows.length; i++) {
      if (rows[i]?.[0]?.trim() === "Campaign") break;
      if (rows[i]?.[0] && rows[i][1] !== undefined) metrics.set(rows[i][0].trim(), rows[i][1]);
    }
    if (i >= rows.length) return fail("Mailchimp tab has no campaign table.", 502);

    const campaigns: Campaign[] = rows
      .slice(i + 1)
      .filter((r) => r[0] && toIsoDate(r[1]))
      .map((r) => ({
        name: r[0].trim(),
        date: toIsoDate(r[1]),
        emailsSent: parseNumber(r[2]),
        openRate: parsePercent(r[3]),
        clickRate: parsePercent(r[4]),
        uniqueOpens: parseNumber(r[5]),
        clicks: parseNumber(r[6]),
      }));

    const m = (k: string) => metrics.get(k) ?? "";
    const data: MailchimpData = {
      audience: m("Audience Name"),
      subscribers: parseNumber(m("Total Subscribers")),
      unsubscribes: parseNumber(m("Unsubscribes (all-time)")),
      cleaned: parseNumber(m("Cleaned Contacts")),
      campaignsSent: parseNumber(m("Campaigns Sent")),
      avgOpenRate: parsePercent(m("Avg Open Rate")),
      avgClickRate: parsePercent(m("Avg Click Rate")),
      lastCampaign: toIsoDate(m("Last Campaign Sent")),
      trackingSince: toIsoDate(m("Audience Created")),
      campaigns,
    };
    return ok(data);
  } catch (e) {
    console.error("[api/mailchimp]", e);
    return fail("Unable to load Mailchimp data from Google Sheets.");
  }
}
