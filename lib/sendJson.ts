export async function sendJson<T = unknown>(url: string, method: "PATCH" | "POST", body: object): Promise<T> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(j?.error || "Unable to save.");
  return j.data as T;
}
