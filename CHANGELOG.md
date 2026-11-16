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

### Phase 6 — Overview
- Overview page: 8 stat cards (Mailchimp, Revenue, HubSpot, Leads), each source fetched independently; a failing source shows "Unable to load" + Retry on its own cards only
- Smart Insights computed from whichever sources loaded
- `GET /api/hubspot` (parses the stacked CONTACTS / COMPANIES sections; ignores HubSpot's sample contacts)
- "Best campaign" now requires 100+ emails sent (Overview and Mailchimp) so tiny sends can't top the ranking

### Design port — Apps Script look and layout
- Ported the Apps Script dashboard's design (Cowley teal theme, 220px sidebar with emoji nav, topbar with live tag, footer, Light/Dark toggle) into `app/globals.css`
- Restyled every page to match: Overview (hero, stat cards with sparklines, Smart Insights, Key Highlights), Mailchimp (hero, snapshot panels, benchmark table, filters, sort, rate pills), Sales & Hours, Leads (banner, stat cards, segment pills, light modal with Pitch Intelligence), Campaign Calendar (feedback box, detail modal with newsletter PDF preview), Documents
- New Hubspot page (Contacts / Companies tabs, search, sortable); `/api/hubspot` now also returns contacts
- Gail Approval moved onto the Documents page (as in the Apps Script version); `/gail-approval` redirects there
- Sidebar becomes a top bar on narrow screens instead of disappearing
- Kept live-data behaviour: independent loading per section, error + Retry states, write-back to the sheets. Observation flags are calculated, not hard-coded. PDF upload to Drive was not ported (Apps Script only).

### Login
- Shared-password sign-in for the whole dashboard (`proxy.ts`, `/login`, `/api/login`, `/api/logout`); pages redirect to the login page and `/api/*` returns 401 until signed in
- Session cookie is HttpOnly, 30 days, derived from `DASHBOARD_PASSWORD` + `AUTH_SECRET` (changing the password signs everyone out); production fails closed if either is missing
- "Sign out" button in the sidebar

### HubSpot as the live source
- `/api/hubspot` now reads Cowley's HubSpot directly (server-side search, sort and paging, 50 per page); the old sheet-based Hubspot tab is no longer used
- Hubspot page: live companies and contacts, search, sortable columns, links to the HubSpot record, and editing saved straight to HubSpot (company: lead status, lifecycle, project status, industry, city, state; contact: title, company, lifecycle). Only those fields can be changed; enum values are checked against HubSpot's allowed options
- Leads: Approve / Not Approved also sets the new company property "Dashboard Approval Status" on the HubSpot company with the same website domain (never creates companies; says when none or several match)
- Overview "HubSpot Companies" now comes from HubSpot totals
- New env var: `HUBSPOT_ACCESS_TOKEN`

### HubSpot-style views
- Hubspot list now mirrors HubSpot's index: object switch (Contacts / Companies), "All contacts" view tab, search, lifecycle-stage and lead-status filters, sort, HubSpot's default columns, numbered pagination and 25/50/100 per page
- New record page `/hubspot/{contacts|companies}/{id}` laid out like HubSpot (left: header + Key information; centre: About tab + profile card; right: associated companies/contacts). Each card has its own Edit button and edits/saves only that card to HubSpot, with a banner naming the card being edited
- `PATCH /api/hubspot` now takes `{type, id, properties}`; every field is validated (allowed fields only, email / phone / domain formats, enum choices, length)
- Not included (needs extra HubSpot permissions): owners, deals, tickets, activity timeline. The Activities tab and "Open in HubSpot" link out to HubSpot

### Create contacts and companies
- "+ Create contact" / "+ Create company" button on the Hubspot list opens a form (light modal, Escape to close) and adds the record to HubSpot, then opens its record page
- `POST /api/hubspot`: same field checks as edits; requires an email or name (contacts) or a name or domain (companies); refuses duplicates (existing email or domain) and links to the existing record

### Documents split
- Document Library (`/documents`) and Gail Approval (`/gail-approval`) are separate pages, each with its own item under the Documents group in the sidebar
