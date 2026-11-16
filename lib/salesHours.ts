import { CLIENT_ALIASES, INTERNAL_CLIENT_PATTERN, LARGE_GAP, STANDARD_RATE } from "./constants";
import { fmtHours, fmtMoney, parseNumber } from "./formatters";
import type { ClientRow, EntryRow, Flag, SalesHoursData, ServiceRow } from "./salesTypes";

const isTotalRow = (...cells: (string | undefined)[]) => cells.some((c) => /(^|\W)(sub)?total(\W|$)/i.test((c ?? "").trim()));

/** Compare client names across systems: "Cancer Connects, Inc." == "Cancer Connects". */
export function normName(s: string): string {
  const words = s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\./g, "")
    .replace(/^\d+-/, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w === "ctr" ? "center" : w === "st" ? "saint" : w))
    .filter((w) => !["inc", "llc", "pc", "co", "corp", "ltd", "company", "the"].includes(w));
  return words.join("");
}

const tokens = (s: string) =>
  new Set(
    s.toLowerCase().replace(/&/g, " and ").replace(/\./g, "").replace(/^\d+-/, "").replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/).filter((w) => w && !["inc", "llc", "pc", "co", "the", "and", "of"].includes(w)),
  );

const SERVICE_RULES: [string, RegExp][] = [
  ["Media Planning", /media (planning|liaison|liason|support)/],
  ["Account Management", /account serv|admin|project mgt|general planning|strategy|discovery/],
  ["Social Media", /social media/],
  ["Email Marketing", /e-?mail|e-news|enews/],
  ["Video", /video|drone/],
  ["PR", /\bpr\b|press/],
  ["Advertising", /advertis|adwords|ad production|billboard|campaign|enrollment/],
  ["Brand / Identity", /brand|logo|letterhead|business card|visual communications/],
  ["Event Marketing", /event|trade show|anniversary/],
  ["Website Maintenance", /(web|wordpress|\bwp\b).*(revision|maintenance|support|update|troubleshoot)|(revision|support|update|troubleshoot)/],
  ["Website Development", /web|wordpress|\bwp\b|section/],
  ["Content Development", /blog|news|content|digital/],
  ["Collateral", /collateral|poster|presentation|creative|mailing|packaging/],
];

export function classifyProject(project: string): string {
  const m = project.match(/^.*?\d{4}-\d+[- ]\s*(.*)$/);
  const title = (m ? m[1] : project.replace(/^\d+-/, "")).toLowerCase();
  for (const [name, re] of SERVICE_RULES) if (re.test(title)) return name;
  return "Other";
}

const cleanFfName = (s: string) => s.replace(/^\d+-/, "").trim();

export function buildSalesHours(qbRows: string[][], ffRows: string[][]): SalesHoursData {
  // --- QuickBooks: skip header, blank, TOTAL/SUBTOTAL
  const qbPeriod = qbRows[0]?.[1] ?? "";
  const qb: { name: string; billed: number }[] = [];
  let qbTotals = 0;
  for (const r of qbRows.slice(1)) {
    if (!r[0]?.trim()) continue;
    if (isTotalRow(r[0])) { qbTotals++; continue; }
    qb.push({ name: r[0].trim(), billed: parseNumber(r[1]) });
  }

  // --- FunctionFox: skip header, TOTAL/SUBTOTAL, blank
  const entries: (EntryRow & { internal: boolean; rawClient: string })[] = [];
  let ffTotals = 0;
  for (const r of ffRows.slice(1)) {
    if (!r[0]?.trim() && !r[1]?.trim()) continue;
    if (isTotalRow(r[0], r[1])) { ffTotals++; continue; }
    const rawClient = (r[0] ?? "").trim();
    entries.push({
      rawClient,
      internal: INTERNAL_CLIENT_PATTERN.test(rawClient),
      client: cleanFfName(rawClient),
      project: (r[1] ?? "").trim(),
      category: classifyProject((r[1] ?? "").trim()),
      personnel: (r[3] ?? "").trim(),
      rate: parseNumber(r[4]),
      hours: parseNumber(r[5]),
      fees: parseNumber(r[6]),
    });
  }

  // --- Match FF clients to QB clients
  const qbByNorm = new Map(qb.map((q) => [normName(q.name), q]));
  const qbByAlias = (n: string) => {
    const a = CLIENT_ALIASES[n];
    return a ? qbByNorm.get(normName(a)) : undefined;
  };
  const matchQb = (ffName: string) => {
    const n = normName(ffName);
    const exact = qbByNorm.get(n) ?? qbByAlias(n);
    if (exact) return exact;
    const ft = tokens(ffName);
    if (ft.size < 2) return undefined;
    const cands = qb.filter((q) => {
      const qt = tokens(q.name);
      return qt.size >= 2 && ([...ft].every((w) => qt.has(w)) || [...qt].every((w) => ft.has(w)));
    });
    return cands.length === 1 ? cands[0] : undefined;
  };

  const clients = new Map<string, ClientRow>();
  const usedQb = new Set<string>();
  const external = entries.filter((e) => !e.internal);
  const ffNames = [...new Set(external.map((e) => e.client))];
  for (const ffName of ffNames) {
    const q = matchQb(ffName);
    const key = q ? q.name : ffName;
    if (q) usedQb.add(q.name);
    const rows = external.filter((e) => e.client === ffName);
    const prev = clients.get(key);
    const base: ClientRow = prev ?? { name: key, services: [], ffHours: 0, ffFees: 0, qbBilled: q?.billed ?? 0, gap: 0 };
    base.ffHours += rows.reduce((s, e) => s + e.hours, 0);
    base.ffFees += rows.reduce((s, e) => s + e.fees, 0);
    base.services = [...new Set([...base.services, ...rows.map((e) => e.category)])].sort();
    clients.set(key, base);
  }
  for (const q of qb) {
    if (!usedQb.has(q.name)) clients.set(q.name, { name: q.name, services: [], ffHours: 0, ffFees: 0, qbBilled: q.billed, gap: 0 });
  }
  const clientRows = [...clients.values()].map((c) => ({ ...c, gap: c.qbBilled - c.ffFees }));
  clientRows.sort((a, b) => b.qbBilled - a.qbBilled);

  // --- Entries shown with display names
  const nameFor = new Map<string, string>();
  for (const ffName of ffNames) nameFor.set(ffName, matchQb(ffName)?.name ?? ffName);
  const entryRows: EntryRow[] = entries.map((e) => ({
    client: e.internal ? "Cowley Associates (internal)" : nameFor.get(e.client) ?? e.client,
    project: e.project,
    category: e.category,
    personnel: e.personnel,
    rate: e.rate,
    hours: e.hours,
    fees: e.fees,
  }));

  // --- Service patterns
  const withHours = clientRows.filter((c) => c.ffHours > 0);
  const svcNames = [...new Set(external.map((e) => e.category))];
  const services: ServiceRow[] = svcNames.map((service) => {
    const rows = external.filter((e) => e.category === service);
    const perClient = new Map<string, number>();
    for (const e of rows) {
      const n = nameFor.get(e.client) ?? e.client;
      perClient.set(n, (perClient.get(n) ?? 0) + e.hours);
    }
    return {
      service,
      clients: perClient.size,
      prevalence: withHours.length ? (perClient.size / withHours.length) * 100 : 0,
      representative: [...perClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n),
      hours: rows.reduce((s, e) => s + e.hours, 0),
      fees: rows.reduce((s, e) => s + e.fees, 0),
    };
  }).sort((a, b) => b.clients - a.clients || b.hours - a.hours);

  // --- Summary
  const totalRevenueBilled = qb.reduce((s, q) => s + q.billed, 0);
  const trackedFees = entries.reduce((s, e) => s + e.fees, 0);
  const totalTrackedHours = entries.reduce((s, e) => s + e.hours, 0);
  const internalHours = entries.filter((e) => e.internal).reduce((s, e) => s + e.hours, 0);
  const unbilled = clientRows.filter((c) => c.qbBilled <= 0 && c.ffFees > 0);

  // --- Flags (all computed)
  const flags: Flag[] = [];
  if (trackedFees > totalRevenueBilled) {
    flags.push({ severity: "danger", title: "Tracked fees exceed QuickBooks billing", detail: `FunctionFox tracked ${fmtMoney(trackedFees)} against ${fmtMoney(totalRevenueBilled)} billed.` });
  }
  const noHours = clientRows.filter((c) => c.qbBilled > 0 && c.ffHours === 0);
  if (noHours.length) {
    flags.push({ severity: "info", title: `${noHours.length} QuickBooks clients have no tracked hours`, detail: `${fmtMoney(noHours.reduce((s, c) => s + c.qbBilled, 0))} billed: ${noHours.map((c) => c.name).join("; ")}.` });
  }
  if (unbilled.length) {
    flags.push({ severity: "warning", title: `${unbilled.length} client(s) with tracked work but no QuickBooks billing`, detail: unbilled.map((c) => `${c.name} (${fmtHours(c.ffHours)} hrs, ${fmtMoney(c.ffFees)})`).join("; ") + "." });
  }
  const bigPos = clientRows.filter((c) => c.ffHours > 0 && c.gap >= LARGE_GAP).sort((a, b) => b.gap - a.gap);
  if (bigPos.length) {
    flags.push({ severity: "info", title: `Billed well above tracked fees (${fmtMoney(LARGE_GAP)}+)`, detail: bigPos.map((c) => `${c.name} +${fmtMoney(c.gap)}`).join("; ") + "." });
  }
  const bigNeg = clientRows.filter((c) => c.qbBilled > 0 && c.gap <= -LARGE_GAP).sort((a, b) => a.gap - b.gap);
  if (bigNeg.length) {
    flags.push({ severity: "warning", title: `Tracked fees well above billing (${fmtMoney(LARGE_GAP)}+)`, detail: bigNeg.map((c) => `${c.name} ${fmtMoney(c.gap)}`).join("; ") + "." });
  }
  if (totalTrackedHours > 0) {
    flags.push({ severity: "info", title: "Internal time", detail: `${fmtHours(internalHours)} of ${fmtHours(totalTrackedHours)} tracked hours (${((internalHours / totalTrackedHours) * 100).toFixed(1)}%) are internal Cowley work, not client work.` });
  }

  return {
    qbPeriod,
    summary: {
      totalRevenueBilled,
      trackedFees,
      totalTrackedHours,
      internalHours,
      externalHours: totalTrackedHours - internalHours,
      revenueGap: totalRevenueBilled - trackedFees,
      totalClients: clientRows.length,
      clientsWithHours: withHours.length,
      standardRate: STANDARD_RATE,
      unbilledTrackedWork: unbilled.reduce((s, c) => s + c.ffFees, 0),
    },
    clients: clientRows,
    services,
    entries: entryRows,
    flags,
    excludedRows: { qbTotals, ffTotals },
  };
}
