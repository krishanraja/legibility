// A real Postgres for the migration tests, in process, with no network and no secrets.
//
// PGlite is Postgres compiled to WebAssembly, so the SQL under supabase/migrations runs here
// exactly as written: the triggers fire, the grants bite, and ISO weeks are Postgres's own.
// What Supabase provides around the public schema is stubbed as thinly as it can be:
//   - the anon, authenticated and service_role roles (service_role bypasses RLS);
//   - Supabase's default privileges, which grant every new public table and function to all
//     three roles, so a test that a table is closed proves the migration closed it;
//   - auth.users and auth.uid();
//   - the slice of pg_cron the migrations call (schedule, unschedule, the job table).
// Every row a test writes is synthetic: generated ids, no addresses, no names, no keys.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const MIGRATIONS_DIR = resolve(__dirname, "../../../supabase/migrations");

const SUPABASE_STUB = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE SCHEMA cron;
CREATE TABLE cron.job (jobid SERIAL PRIMARY KEY, jobname TEXT, schedule TEXT, command TEXT);
CREATE FUNCTION cron.schedule(_name TEXT, _schedule TEXT, _command TEXT) RETURNS BIGINT
  LANGUAGE sql AS $$ INSERT INTO cron.job (jobname, schedule, command) VALUES (_name, _schedule, _command) RETURNING jobid::bigint $$;
CREATE FUNCTION cron.unschedule(_name TEXT) RETURNS BOOLEAN
  LANGUAGE sql AS $$ DELETE FROM cron.job WHERE jobname = _name RETURNING true $$;
`;

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** A fresh database with every migration in the repository applied, in order. */
export async function migratedDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of migrationFiles()) {
    try {
      await db.exec(readFileSync(resolve(MIGRATIONS_DIR, file), "utf8"));
    } catch (err) {
      throw new Error(`migration ${file} failed: ${(err as Error).message}`);
    }
  }
  return db;
}

/** A synthetic account: an auth user with a generated id and no address. */
export async function makeAccount(db: PGlite): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "INSERT INTO auth.users DEFAULT VALUES RETURNING id",
  );
  return rows[0].id;
}

/** A synthetic key on an account. The hash is random bytes, never a real key's hash. */
export async function makeKey(db: PGlite, accountId: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO public.api_keys (user_id, prefix, key_hash, last_four)
     VALUES ($1, 'synthetic', md5(gen_random_uuid()::text), 'none') RETURNING id`,
    [accountId],
  );
  return rows[0].id;
}

export type ReadFixture = {
  at: string;
  endpoint?: string | null;
  product?: boolean | null;
  confidence?: number | null;
  calibration?: string | null;
};

/** One metered call. Defaults describe a trusted REST read. */
export async function makeRead(
  db: PGlite,
  accountId: string,
  keyId: string,
  read: ReadFixture,
): Promise<void> {
  const endpoint = read.endpoint === undefined ? "/api/v1/read_product" : read.endpoint;
  const product = read.product === undefined ? true : read.product;
  const confidence = read.confidence === undefined ? 0.91 : read.confidence;
  const calibration = read.calibration === undefined ? "synthetic-cal" : read.calibration;
  await db.query(
    `INSERT INTO public.usage_events
       (user_id, api_key_id, tool, endpoint, product_returned, confidence, calibration_version,
        billable, created_at)
     VALUES ($1, $2, 'read_product', $3, $4, $5, $6, $7, $8)`,
    [
      accountId,
      keyId,
      endpoint,
      product,
      confidence,
      calibration,
      product === true && (confidence ?? 0) >= 0.7,
      read.at,
    ],
  );
}
