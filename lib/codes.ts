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
