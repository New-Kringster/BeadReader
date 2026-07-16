// One-click deploy helper: applies the SQL migrations and (optionally) creates
// the first admin, so a fresh Supabase database is fully set up during the
// Vercel build. Wired in as the `vercel-build` step (see package.json).
//
// It connects with the Postgres connection string that the Vercel↔Supabase
// integration injects (POSTGRES_URL_NON_POOLING / POSTGRES_URL). If no such
// URL is present — e.g. a normal local `next build`, or a deploy that wired
// Supabase up by hand — it skips quietly and leaves the DB untouched.
//
// Everything here is idempotent: each migration file is recorded in
// `schema_migrations` and only applied once, and the admin is created only if
// none exists yet. Re-running on every deploy is safe.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "supabase", "migrations");

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.log("[setup-db] No Postgres URL in the environment — skipping DB setup.");
  process.exit(0);
}

// Supabase's connection string carries `sslmode=require`, which newer pg treats
// as full certificate-chain verification (`verify-full`). Supabase presents a
// self-signed root, so that fails with SELF_SIGNED_CERT_IN_CHAIN. We connect
// over TLS but without chain verification (the connection secret is the trust
// anchor). Belt and suspenders, because pg's precedence between the connection
// string's sslmode and the explicit `ssl` option has changed across versions:
//   1) drop the sslmode param from the URL, and
//   2) disable TLS rejection for this process only.
// This runs in its own `node` process that exits before `next build`, so it
// never affects the app build or runtime.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let sslConnectionString = connectionString;
try {
  const u = new URL(connectionString);
  u.searchParams.delete("sslmode");
  sslConnectionString = u.toString();
} catch {
  // Not a parseable URL — fall back to the raw string.
}

const client = new pg.Client({
  connectionString: sslConnectionString,
  // Supabase requires TLS; its hosts use a managed/self-signed chain.
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  // Ledger of applied migrations, so each file runs exactly once.
  await client.query(
    `create table if not exists public.schema_migrations (
       name text primary key,
       applied_at timestamptz not null default now()
     )`
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const { rowCount } = await client.query(
      "select 1 from public.schema_migrations where name = $1",
      [file]
    );
    if (rowCount) {
      console.log(`[setup-db] ${file} — already applied`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`[setup-db] applying ${file}…`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into public.schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`[setup-db] ${file} — done`);
    } catch (err) {
      await client.query("rollback");
      console.error(`[setup-db] ${file} — FAILED: ${err.message}`);
      throw err;
    }
  }

  // First admin. Only when a code is provided and no admin exists yet.
  const adminCode = process.env.BOOTSTRAP_ADMIN_CODE?.trim();
  if (adminCode) {
    const { rowCount } = await client.query(
      "select 1 from public.users where role = 'admin' limit 1"
    );
    if (rowCount) {
      console.log("[setup-db] an admin already exists — skipping bootstrap.");
    } else {
      await client.query(
        `insert into public.users (name, role, access_code, has_explicit_access)
         values ('Admin', 'admin', $1, true)`,
        [adminCode]
      );
      console.log("[setup-db] created the first admin from BOOTSTRAP_ADMIN_CODE.");
    }
  } else {
    console.log("[setup-db] BOOTSTRAP_ADMIN_CODE not set — skipping admin bootstrap.");
  }

  console.log("[setup-db] complete.");
} finally {
  await client.end();
}
