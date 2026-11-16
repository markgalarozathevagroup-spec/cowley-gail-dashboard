# Changelog

## 2026-11-16

### Added
- Next.js app, Cowley sidebar/layout, light high-contrast design tokens
- Server-only Google Sheets helper (`lib/googleSheets.ts`)
- `GET /api/mailchimp` (standard `{success,data}` / `{success,error}` responses)
- Mailchimp page: audience cards, Year/Month filters + Reset, sortable campaigns, Industry Performance Comparison
- Loading skeletons, error state with Retry, 20s request timeout
- Placeholder pages for later phases

### Phase 2 — Leads
- `GET /api/leads` (all rows, no limit, columns located by header name) and `PATCH /api/leads` (validates row, lead ID match, and status; writes only the Status cell)
- Leads page: segment + status filters (default Pending Review), summary cards, light accessible detail modal with large Approve / Not Approved buttons
- Sheet values `approved` / `rejected` / blank are read as Approved / Not Approved / Pending Review; new writes use "Approved" and "Not Approved"

### Phase 3 — Sales & Hours
- `GET /api/sales-hours` combines `Sales by Customer Summary` and `Function Fox Hours`; TOTAL/SUBTOTAL rows are filtered out before any calculation
- Executive Summary cards and four tabs: Client Detail, Service Pattern Analysis, Function Fox Hours, Key Observations & Flags (all sortable tables, all computed from live data)
- FunctionFox projects are classified into service categories by keyword (`lib/salesHours.ts`); FunctionFox and QuickBooks client names are matched by normalised name, with a small alias list in `lib/constants.ts` (RMS, Young & Franklin/Tactair)
- Internal "1000-Cowley Associates" time counts toward total hours but not External Client Hours or client lists
- Gap = QuickBooks billed minus FunctionFox fees

### Phase 4 — Campaign Calendar
- `GET /api/campaign-calendar` (columns found by header) and `PATCH /api/campaign-calendar` (validates row, theme match, status, feedback length; writes only the Status and "Gail's Feedback" cells)
- Page: status filter buttons (default Pending Review), Approve / Not Approved buttons, editable Gail's Feedback with explicit Save, link to the draft PDF
- Sheet statuses other than approved/not approved (e.g. "Draft - for Gail review") display as Pending Review

### Phase 5 — Document Library & Gail Approval
- `GET/PATCH/POST /api/documents`: summary cards that filter the list, inline editing of title/purpose/link, status dropdown, "+ Add Document" (appends a Pending Review row; links must be http/https)
- `GET/PATCH /api/gail-approval`: Needs Gail / In Review / Done / Not Needed cards, editable status and notes; shown as its own sidebar item under Documents
- All writes validate row, a name guard against stale rows, allowed fields/statuses, and payload types
