export interface ClientRow {
  name: string;
  services: string[];
  ffHours: number;
  ffFees: number;
  qbBilled: number;
  gap: number; // qbBilled - ffFees
}

export interface ServiceRow {
  service: string;
  clients: number;
  prevalence: number; // % of clients with tracked hours
  representative: string[];
  hours: number;
  fees: number;
}

export interface EntryRow {
  client: string;
  project: string;
  category: string;
  personnel: string;
  rate: number;
  hours: number;
  fees: number;
}

export interface Flag {
  severity: "warning" | "info" | "danger";
  title: string;
  detail: string;
}

export interface SalesHoursData {
  qbPeriod: string;
  summary: {
    totalRevenueBilled: number;
    trackedFees: number;
    totalTrackedHours: number;
    internalHours: number;
    externalHours: number;
    revenueGap: number;
    totalClients: number;
    clientsWithHours: number;
    standardRate: number;
    unbilledTrackedWork: number;
  };
  clients: ClientRow[];
  services: ServiceRow[];
  entries: EntryRow[];
  flags: Flag[];
  excludedRows: { qbTotals: number; ffTotals: number };
}
