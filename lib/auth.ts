/** Shared-password session using Web Crypto (works in proxy and route handlers). */
export const COOKIE = "gd_session";
export const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

/** The session value is derived from BOTH secrets, so changing the password signs everyone out. */
export async function sessionToken(): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  const password = process.env.DASHBOARD_PASSWORD;
  if (!secret || !password) return null;
  return hmac(secret, `gd-session-v1:${password}`);
}

export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function passwordMatches(input: string): Promise<boolean> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return false;
  // compare digests so length differences leak nothing
  const [a, b] = await Promise.all([hmac("cmp", input), hmac("cmp", password)]);
  return timingSafeEqual(a, b);
}
