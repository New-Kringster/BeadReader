import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service_role key.
 *
 * This key BYPASSES Row Level Security. Every table has RLS enabled with no
 * policies, so nothing is reachable with a public key — all access flows through
 * this admin client inside server code, and the explicit-content gate is applied
 * in the queries themselves (see lib/data.ts). Never import this into a Client
 * Component (the "server-only" import above will error if you try).
 */
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill them in."
  );
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const COVERS_BUCKET = "covers";
