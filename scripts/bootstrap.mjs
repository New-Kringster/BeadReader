// Creates the very first admin access code. Idempotent-ish: if an admin with the
// target code already exists it just prints it. Run with:
//   npm run bootstrap
// (which loads .env.local via node --env-file). Requires SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY. Optionally set BOOTSTRAP_ADMIN_CODE to choose the code.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your environment.");
  process.exit(1);
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randCode() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  const s = [...b].map((x) => ALPHABET[x % ALPHABET.length]).join("");
  return `ADMIN-${s}`;
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const code = process.env.BOOTSTRAP_ADMIN_CODE || randCode();

// Already there?
const { data: existing } = await supabase
  .from("users")
  .select("id, role, access_code")
  .eq("access_code", code)
  .maybeSingle();

if (existing) {
  console.log(`\n✓ Admin already exists with this code.\n\n   Access code: ${existing.access_code}\n`);
  process.exit(0);
}

const { data, error } = await supabase
  .from("users")
  .insert({ name: "Admin", role: "admin", access_code: code, has_explicit_access: true })
  .select("access_code")
  .single();

if (error) {
  console.error("Failed to create admin:", error.message);
  process.exit(1);
}

console.log(`\n✓ First admin created.\n\n   Access code: ${data.access_code}\n\n   Log in at /login with this code, then create readers under Admin → Readers.\n`);
