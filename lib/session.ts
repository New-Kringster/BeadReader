/**
 * Signed session token: `${userId}.${hmac(userId)}`.
 *
 * Uses the Web Crypto API (globalThis.crypto.subtle), which is available in both
 * the Node.js runtime (Server Components / Route Handlers) and the Edge runtime
 * (middleware), so the exact same verification runs everywhere.
 */
export const SESSION_COOKIE = "br_session";

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET env var.");
  return secret;
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison to avoid timing leaks on the signature. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(userId: string): Promise<string> {
  return `${userId}.${await hmacHex(userId)}`;
}

/** Returns the userId if the token's signature is valid, otherwise null. */
export async function verifySession(
  token: string | undefined | null
): Promise<string | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacHex(userId);
  return safeEqual(sig, expected) ? userId : null;
}
