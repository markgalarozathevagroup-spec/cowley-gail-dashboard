import "server-only";
import { google } from "googleapis";

export function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key || !process.env.GOOGLE_SHEET_ID) {
    throw new Error("Google Sheets credentials are not configured on the server.");
  }
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key.replace(/\\n/g, "\n") },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/** Read a whole tab as formatted strings (e.g. "20.34%"). */
export async function readTab(tab: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: `'${tab.replace(/'/g, "''")}'`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (res.data.values as string[][] | undefined) ?? [];
}

export function colLetter(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Write exactly one cell. Callers must pass a validated tab/row/column. */
export async function writeCell(tab: string, colIndex: number, row: number, value: string) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: `'${tab.replace(/'/g, "''")}'!${colLetter(colIndex)}${row}`,
    valueInputOption: "RAW",
    requestBody: { values: [[value]] },
  });
}

/** Append one row after the last row of data; returns the 1-based row number it landed on. */
export async function appendRow(tab: string, values: string[]): Promise<number> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: `'${tab.replace(/'/g, "''")}'!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
  const m = res.data.updates?.updatedRange?.match(/!\D+(\d+)/);
  return m ? Number(m[1]) : 0;
}
