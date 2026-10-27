// A2 acceptance tests: attribution capture, run against every migration in the repository
// applied to a real Postgres (see ./supabase-stub.ts). The browser's rules
// (src/lib/api/attribution.ts) produce the touches, so the two halves are tested together.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  channelLabel,
  invitationId,
  landingTouch,
  serializeTouch,
  TOUCH_COOKIE,
  touchFromCookie,
  utmValue,
  type Touch,
} from "@/lib/api/attribution";
import { makeKey, migratedDatabase } from "./supabase-stub";

type TouchRow = {
  kind: string;
  account_id: string | null;
  key_id: string | null;
  invitation_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_host: string | null;
  directory: string | null;
  client: string | null;
  channel: string;
  occurred_at: Date;
};

// Synthetic: no real invitation, campaign, person or address.
const INV = "legibility:wave-1:synthetic.0001";

let db: PGlite;

beforeAll(async () => {
  db = await migratedDatabase();
}, 60_000);

beforeEach(async () => {
  await db.exec("RESET ROLE");
  await db.exec(
    "DELETE FROM public.growth_events; DELETE FROM public.attribution_touches; DELETE FROM public.internal_accounts; DELETE FROM public.api_keys; DELETE FROM auth.users;",
  );
});

/** A landing in a browser, as the page records it, then that browser's cookie. */
function land(search: string, referrer = "", now = new Date()): Touch | null {
  const t = landingTouch({ search, referrer, now });
  if (!t) return null;
  return touchFromCookie(`${TOUCH_COOKIE}=${serializeTouch(t)}`, now);
}

/** Supabase creating an account from signInWithOtp, with the touch as sign-up metadata. */
async function signUp(touch: unknown): Promise<string> {
  const meta = touch === undefined ? {} : { attribution: touch };
  const { rows } = await db.query<{ id: string }>(
    "INSERT INTO auth.users (raw_user_meta_data) VALUES ($1::jsonb) RETURNING id",
    [JSON.stringify(meta)],
  );
  return rows[0].id;
}

async function touchesOf(accountId: string): Promise<TouchRow[]> {
  const { rows } = await db.query<TouchRow>(
    "SELECT * FROM public.attribution_touches WHERE account_id = $1 ORDER BY kind",
    [accountId],
  );
  return rows;
}

async function source(accountId: string): Promise<string> {
  const { rows } = await db.query<{ s: string }>(
    "SELECT public.account_acquisition_source($1) AS s",
    [accountId],
  );
  return rows[0].s;
}

describe("A2: enrolment", () => {
  it("1. a landing with all four utm values, then enrolment: the account carries them and is labelled invitation", async () => {
    const touch = land(
      `?utm_source=outreach&utm_medium=email&utm_campaign=wave-1&utm_content=${encodeURIComponent(INV)}`,
    );
    const account = await signUp(touch);
    const [row] = await touchesOf(account);
    expect(row).toMatchObject({
      kind: "enrolment",
      invitation_id: INV,
      utm_source: "outreach",
      utm_medium: "email",
      utm_campaign: "wave-1",
      channel: "invitation",
    });
    expect(row.occurred_at.toISOString()).toBe(touch?.touched_at);
    expect(await source(account)).toBe("invitation");
  });

  it("2. an over-long or malformed invitation id is dropped, by the browser and again by the database", async () => {
    expect(land(`?utm_source=x&utm_content=legibility:${"a".repeat(110)}`)?.invitation_id).toBe(
      null,
    );
    // Forged sign-up metadata that skipped the browser's rules.
    const account = await signUp({
      invitation_id: "legibility:bad value!",
      utm_source: "outreach",
      touched_at: new Date().toISOString(),
    });
    const [row] = await touchesOf(account);
    expect(row.invitation_id).toBeNull();
    expect(row.channel).toBe("utm:outreach");
  });

  it("3. a referrer is kept as its host only; a forged path is refused", async () => {
    const touch = land("?utm_source=newsletter", "https://news.example.test/issue/9?reader=x");
    const account = await signUp(touch);
    expect((await touchesOf(account))[0].referrer_host).toBe("news.example.test");

    const forged = await signUp({
      utm_source: "x",
      referrer_host: "news.example.test/issue/9?reader=x",
      touched_at: new Date().toISOString(),
    });
    expect((await touchesOf(forged))[0].referrer_host).toBeNull();

    const ip = await signUp({
      utm_source: "x",
      referrer_host: "10.0.0.1",
      touched_at: new Date().toISOString(),
    });
    expect((await touchesOf(ip))[0].referrer_host).toBeNull();
  });

  it("8. no parameters and no recognised referrer: no touch, and the label is direct", async () => {
    expect(land("", "https://example.test/")).toBeNull();
    const account = await signUp(undefined);
    expect(await touchesOf(account)).toEqual([]);
    expect(await source(account)).toBe("direct");
  });

  it("an internal account is labelled internal whatever its touch", async () => {
    const account = await signUp(land(`?utm_source=x&utm_content=${INV}`));
    await db.query(
      "INSERT INTO public.internal_accounts (account_id, class) VALUES ($1, 'krish')",
      [account],
    );
    expect(await source(account)).toBe("internal");
  });

  it("a malformed touch never stops a sign-up", async () => {
    for (const bad of [
      "not an object",
      { touched_at: "not a time", utm_source: "x" },
      { utm_source: ["x"] },
    ]) {
      const account = await signUp(bad);
      const { rows } = await db.query("SELECT 1 FROM auth.users WHERE id = $1", [account]);
      expect(rows).toHaveLength(1);
    }
  });

  it("a touch dated in the future or past 30 days is dated at enrolment instead", async () => {
    const before = Date.now();
    const account = await signUp({ utm_source: "x", touched_at: "2099-01-01T00:00:00Z" });
    const [row] = await touchesOf(account);
    expect(row.occurred_at.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(row.occurred_at.getTime()).toBeLessThan(Date.now() + 60_000);
  });

  it("an account has one enrolment touch", async () => {
    const account = await signUp(land("?utm_source=x"));
    await db.query(
      "SELECT public.insert_attribution_touch('enrolment', $1, NULL, $2::jsonb, now())",
      [account, JSON.stringify({ utm_source: "y" })],
    );
    const rows = await touchesOf(account);
    expect(rows).toHaveLength(1);
    expect(rows[0].utm_source).toBe("x");
  });
});

describe("A2: keys", () => {
  it("4. the engineer path: a fresh browser opens an introduction link, enrols and creates a key", async () => {
    // The trial link Krish sends after the call carries the leader's invitation id.
    const browser = land(
      `?utm_source=outreach&utm_medium=introduction&utm_campaign=wave-1&utm_content=${encodeURIComponent(INV)}`,
    );
    const engineer = await signUp(browser);
    const key = await makeKey(db, engineer);
    await db.query("SELECT public.record_key_creation($1, $2::jsonb)", [
      key,
      JSON.stringify(browser),
    ]);

    const rows = await touchesOf(engineer);
    const keyTouch = rows.find((r) => r.kind === "key_creation");
    expect(keyTouch).toMatchObject({
      key_id: key,
      invitation_id: INV,
      utm_medium: "introduction",
      channel: "introduction",
    });
    expect(await source(engineer)).toBe("introduction");

    const { rows: events } = await db.query<{ type: string; source: string }>(
      "SELECT type, source FROM public.growth_events WHERE account_id = $1",
      [engineer],
    );
    expect(events).toEqual([{ type: "key_created", source: "introduction" }]);
  });

  it("4b. a key created in a browser with no touch inherits the enrolment touch", async () => {
    const engineer = await signUp(
      land(`?utm_source=outreach&utm_medium=introduction&utm_content=${INV}`),
    );
    const key = await makeKey(db, engineer);
    await db.query("SELECT public.record_key_creation($1, NULL)", [key]);
    const keyTouch = (await touchesOf(engineer)).find((r) => r.kind === "key_creation");
    expect(keyTouch?.invitation_id).toBe(INV);
    expect(keyTouch?.utm_medium).toBe("introduction");
  });

  it("5. a key created before the touch keeps its earlier creation time and its touch", async () => {
    const builder = await signUp(undefined);
    const key = await makeKey(db, builder);
    await db.query("UPDATE public.api_keys SET created_at = '2026-10-20T08:00:00Z' WHERE id = $1", [
      key,
    ]);
    await db.query("SELECT public.record_key_creation($1, NULL)", [key]);

    // A later invitation touch reaches the same key.
    await db.query("SELECT public.record_key_creation($1, $2::jsonb)", [
      key,
      JSON.stringify(land(`?utm_source=outreach&utm_content=${INV}`)),
    ]);

    const { rows: k } = await db.query<{ created_at: Date }>(
      "SELECT created_at FROM public.api_keys WHERE id = $1",
      [key],
    );
    expect(k[0].created_at.toISOString()).toBe("2026-10-20T08:00:00.000Z");
    const keyTouch = (await touchesOf(builder)).find((r) => r.kind === "key_creation");
    expect(keyTouch?.invitation_id).toBeNull();
    expect(keyTouch?.occurred_at.toISOString()).toBe("2026-10-20T08:00:00.000Z");
    const { rows: events } = await db.query(
      "SELECT 1 FROM public.growth_events WHERE type = 'key_created'",
    );
    expect(events).toHaveLength(1);
  });

  it("6. the first client is kept once; a later client and a malformed one are not", async () => {
    const builder = await signUp(undefined);
    const key = await makeKey(db, builder);
    await db.query("SELECT public.record_key_creation($1, NULL)", [key]);
    const keep = async (c: string) =>
      (
        await db.query<{ kept: boolean }>("SELECT public.record_key_client($1, $2) AS kept", [
          key,
          c,
        ])
      ).rows[0].kept;
    expect(await keep("<bad>")).toBe(false);
    expect(await keep("curl")).toBe(true);
    expect(await keep("Example Client")).toBe(false);
    const keyTouch = (await touchesOf(builder)).find((r) => r.kind === "key_creation");
    expect(keyTouch?.client).toBe("curl");
  });

  it("refuses an unknown key", async () => {
    await expect(
      db.query("SELECT public.record_key_creation(gen_random_uuid(), NULL)"),
    ).rejects.toThrow(/unknown_key/);
  });
});

describe("A2: sign-up", () => {
  it("record_email_verified answers first exactly once per account", async () => {
    const account = await signUp(land(`?utm_source=outreach&utm_content=${INV}`));
    const claim = async () =>
      (
        await db.query<{ first: boolean; source: string; invitation_id: string | null }>(
          "SELECT * FROM public.record_email_verified($1)",
          [account],
        )
      ).rows[0];
    expect(await claim()).toEqual({ first: true, source: "invitation", invitation_id: INV });
    expect(await claim()).toEqual({ first: false, source: "invitation", invitation_id: INV });
    const { rows } = await db.query(
      "SELECT 1 FROM public.growth_events WHERE type = 'email_verified' AND account_id = $1",
      [account],
    );
    expect(rows).toHaveLength(1);
  });
});

describe("A2: one rule in two places", () => {
  it("the database's channel label and field rules match the browser's", async () => {
    const cases: Partial<Touch>[] = [
      {},
      { invitation_id: INV, utm_medium: "introduction" },
      { invitation_id: INV, utm_medium: "email" },
      { directory: "smithery", utm_source: "x" },
      { utm_source: "a".repeat(100) },
      { referrer_host: "example.test" },
      { utm_medium: "email" },
    ];
    for (const c of cases) {
      const t = {
        invitation_id: null,
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        referrer_host: null,
        directory: null,
        touched_at: "",
        ...c,
      } as Touch;
      const { rows } = await db.query<{ l: string }>(
        "SELECT public.attribution_channel($1, $2, $3, $4, $5) AS l",
        [t.invitation_id, t.utm_source, t.utm_medium, t.directory, t.referrer_host],
      );
      expect(rows[0].l).toBe(channelLabel(t));
    }

    for (const v of [
      "Wave-1",
      " x ",
      "a".repeat(100),
      "a".repeat(101),
      "-x",
      "a b",
      "",
      "10.0.0.1",
      "v1.2.3",
    ]) {
      const { rows } = await db.query<{ u: string | null }>(
        "SELECT public.attribution_utm($1) AS u",
        [v],
      );
      expect(rows[0].u).toBe(utmValue(v));
    }
    for (const v of [INV, `legibility:${"a".repeat(110)}`, "legibility:a b", "other:x"]) {
      const { rows } = await db.query<{ i: string | null }>(
        "SELECT public.attribution_invitation($1) AS i",
        [v],
      );
      expect(rows[0].i).toBe(invitationId(v));
    }
  });
});

describe("A2: access", () => {
  it("anonymous and signed-in roles can neither read the tables nor call the functions", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      for (const sql of [
        "SELECT * FROM public.attribution_touches",
        "SELECT * FROM public.growth_events",
        "SELECT public.record_key_creation(gen_random_uuid(), NULL)",
        "SELECT public.record_key_client(gen_random_uuid(), 'x')",
        "SELECT * FROM public.record_email_verified(gen_random_uuid())",
        "SELECT public.account_acquisition_source(gen_random_uuid())",
      ]) {
        await expect(db.query(sql)).rejects.toThrow(/permission denied/);
      }
      await db.exec("RESET ROLE");
    }
  });

  it("the service role can write a touch directly, with the field rules enforced", async () => {
    const account = await signUp(undefined);
    await db.exec("SET ROLE service_role");
    await db.query(
      "INSERT INTO public.attribution_touches (kind, account_id, utm_source) VALUES ('enrolment', $1, 'x')",
      [account],
    );
    await expect(
      db.query(
        "INSERT INTO public.attribution_touches (kind, account_id, utm_source) VALUES ('landing', NULL, 'Not Valid')",
      ),
    ).rejects.toThrow(/check constraint/);
    await db.exec("RESET ROLE");
  });
});
