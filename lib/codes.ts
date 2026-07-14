/**
 * Access-code generation. Codes are the only credential in the app, so they need
 * to be unguessable but still easy to read out / paste. We use an unambiguous
 * alphabet (no 0/O/1/I/L) grouped as XXXX-XXXX.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomChars(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** e.g. "K7Q4-9MPX" (reader) or with a prefix like "ADMIN-K7Q49MPX". */
export function generateAccessCode(prefix?: string): string {
  const core = `${randomChars(4)}-${randomChars(4)}`;
  return prefix ? `${prefix}-${core.replace("-", "")}` : core;
}

/** Validate a user-chosen access code. Returns an error message, or null if OK. */
export function validateAccessCode(code: string): string | null {
  const c = code.trim();
  if (c.length < 4) return "Use at least 4 characters.";
  if (c.length > 40) return "That's too long (40 characters max).";
  if (/\s/.test(c)) return "No spaces in the code, please.";
  return null;
}
