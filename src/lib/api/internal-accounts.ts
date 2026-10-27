// A1: the internal list. The rules the admin action and the metrics page share.
//
// The list itself lives in the database (internal_accounts, internal_keys), never in git:
// membership is added at run time by an admin on /dashboard/metrics. This module holds only
// what is safe and useful to know in code: the closed set of classes, how the admin form's
// input is read, how a database refusal is put into words, and how the week is summarised.

/** Every internal class. The database CHECK constraint holds the same eight. */
export const INTERNAL_CLASSES = [
  "krish",
  "engine",
  "testbench",
  "directory_test",
  "registry",
  "ci",
  "demo",
  "smoke",
] as const;

export type InternalClass = (typeof INTERNAL_CLASSES)[number];

export function isInternalClass(value: unknown): value is InternalClass {
  return typeof value === "string" && (INTERNAL_CLASSES as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AccountIdentifier = { kind: "id"; id: string } | { kind: "email"; email: string };

/**
 * The admin types either an account id or the account's sign-in address. Anything else is
 * refused before it reaches the database. The address is used only to look the account up
 * at that moment; the row written is keyed by account id.
 */
export function parseAccountIdentifier(input: string): AccountIdentifier | null {
  const value = input.trim();
  if (UUID.test(value)) return { kind: "id", id: value.toLowerCase() };
  if (ADDRESS.test(value)) return { kind: "email", email: value.toLowerCase() };
  return null;
}

type DbError = { code?: string | null; message?: string | null } | null | undefined;

/** A refusal from the database, in plain words. Never echoes ids or input back. */
export function internalListErrorMessage(error: DbError): string {
  const message = error?.message ?? "";
  if (message.includes("internal_key_on_external_account")) {
    return "That key's account is not on the internal list. Add the account first.";
  }
  if (error?.code === "23514") return "That is not one of the internal classes.";
  if (error?.code === "23503") return "No account or key with that id.";
  return "That did not save.";
}

export type WeeklyKeyRow = {
  iso_week: string;
  week_start: string;
  key_id: string;
  trusted_reads: number | string;
};

/** The number for a week is the count of northstar_weekly_keys rows for it. */
export function summariseWeek(rows: WeeklyKeyRow[]): {
  isoWeek: string | null;
  keys: number;
  trustedReads: number;
} {
  return {
    isoWeek: rows[0]?.iso_week ?? null,
    keys: rows.length,
    trustedReads: rows.reduce((sum, r) => sum + Number(r.trusted_reads), 0),
  };
}
