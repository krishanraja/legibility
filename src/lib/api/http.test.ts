import { describe, expect, it } from "vitest";
import { getOnly, postOnly } from "./http";

/**
 * These guards exist so an API path never falls through to the SPA shell. A 200 text/html
 * on /api/v1/read_product tells an integrator their call succeeded when it did not, which
 * is the specific failure this module was written to prevent.
 */

describe("postOnly", () => {
  it.each(["GET", "PUT", "DELETE", "PATCH", "HEAD"] as const)(
    "rejects %s with 405 and an Allow header",
    async (method) => {
      const res = await postOnly[method]();
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST");
      expect(res.headers.get("content-type")).toBe("application/json");
      const body = await res.json();
      expect(body.error).toBe("method_not_allowed");
      expect(body.message).toContain("POST");
    },
  );

  it("answers OPTIONS with 204 and the full method list for CORS preflight", async () => {
    const res = await postOnly.OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("allow")).toBe("POST, OPTIONS");
    expect(await res.text()).toBe("");
  });

  it("does not define POST, so the real handler always wins when spread", () => {
    // The guards are spread BEFORE the real method. If postOnly defined POST it would
    // shadow the actual route handler and every endpoint would 405.
    expect("POST" in postOnly).toBe(false);
  });

  it("never returns HTML, which is the whole point", async () => {
    const res = await postOnly.GET();
    expect(res.headers.get("content-type")).not.toContain("text/html");
  });
});

describe("getOnly", () => {
  it.each(["POST", "PUT", "DELETE", "PATCH"] as const)(
    "rejects %s with 405 and an Allow header",
    async (method) => {
      const res = await getOnly[method]();
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("GET");
      const body = await res.json();
      expect(body.error).toBe("method_not_allowed");
    },
  );

  it("answers OPTIONS with 204", async () => {
    const res = await getOnly.OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("allow")).toBe("GET, OPTIONS");
  });

  it("does not define GET, so the real handler wins", () => {
    expect("GET" in getOnly).toBe(false);
  });

  it("does not guard HEAD, which browsers pair with GET", () => {
    // Documenting current behaviour: getOnly omits HEAD so it falls through to the route.
    expect("HEAD" in getOnly).toBe(false);
  });
});
