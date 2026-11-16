/** Shared (client + server) description of the HubSpot cards shown on a record page. */
export type ObjType = "company" | "contact";
export type Kind = "text" | "enum" | "email" | "phone" | "domain" | "date" | "readonly";
export interface FieldDef { key: string; label: string; kind: Kind }
export interface CardDef { id: string; title: string; column: "left" | "center"; fields: FieldDef[] }

export const CARDS: Record<ObjType, CardDef[]> = {
  contact: [
    {
      id: "key", title: "Key information", column: "left",
      fields: [
        { key: "lifecyclestage", label: "Lifecycle Stage", kind: "enum" },
        { key: "hs_lead_status", label: "Lead Status", kind: "enum" },
        { key: "phone", label: "Phone Number", kind: "phone" },
        { key: "createdate", label: "Create Date", kind: "date" },
        { key: "lastmodifieddate", label: "Last Modified", kind: "date" },
      ],
    },
    {
      id: "profile", title: "Contact profile", column: "center",
      fields: [
        { key: "firstname", label: "First name", kind: "text" },
        { key: "lastname", label: "Last name", kind: "text" },
        { key: "jobtitle", label: "Job title", kind: "text" },
        { key: "company", label: "Company name", kind: "text" },
        { key: "email", label: "Email", kind: "email" },
        { key: "address", label: "Street address", kind: "text" },
        { key: "city", label: "City", kind: "text" },
        { key: "state", label: "State/Region", kind: "text" },
        { key: "zip", label: "Postal code", kind: "text" },
      ],
    },
  ],
  company: [
    {
      id: "key", title: "Key information", column: "left",
      fields: [
        { key: "lifecyclestage", label: "Lifecycle Stage", kind: "enum" },
        { key: "hs_lead_status", label: "Lead Status", kind: "enum" },
        { key: "project_status", label: "Project status", kind: "enum" },
        { key: "industry", label: "Industry", kind: "enum" },
        { key: "phone", label: "Phone Number", kind: "phone" },
        { key: "dashboard_approval_status", label: "Dashboard Approval", kind: "readonly" },
        { key: "createdate", label: "Create Date", kind: "date" },
        { key: "lastmodifieddate", label: "Last Modified", kind: "date" },
      ],
    },
    {
      id: "profile", title: "Company profile", column: "center",
      fields: [
        { key: "name", label: "Company name", kind: "text" },
        { key: "domain", label: "Company domain name", kind: "domain" },
        { key: "address", label: "Street address", kind: "text" },
        { key: "city", label: "City", kind: "text" },
        { key: "state", label: "State/Region", kind: "text" },
        { key: "zip", label: "Postal code", kind: "text" },
        { key: "country", label: "Country/Region", kind: "text" },
      ],
    },
  ],
};

export const allFields = (t: ObjType) => CARDS[t].flatMap((c) => c.fields);
export const EDITABLE_KINDS: Kind[] = ["text", "enum", "email", "phone", "domain"];
export const editableKeys = (t: ObjType) => allFields(t).filter((f) => EDITABLE_KINDS.includes(f.kind)).map((f) => f.key);
