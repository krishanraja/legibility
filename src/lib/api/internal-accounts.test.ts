import { describe, expect, it } from "vitest";

import {
  INTERNAL_CLASSES,
  internalListErrorMessage,
  isInternalClass,
  parseAccountIdentifier,
  summariseWeek,
} from "./internal-accounts";

// Synthetic and built at run time, on the reserved .invalid domain, so no address is ever
// written into this file.
const SYNTHETIC_ADDRESS = ["Someone", "Example.INVALID"].join("@");

describe("internal classes", () => {
  it("are exactly the eight the brief names", () => {
    expect([...INTERNAL_CLASSES]).toEqual([
      "krish",
      "engine",
      "testbench",
      "directory_test",
      "registry",
      "ci",
      "demo",
      "smoke",
    ]);
  });

  it("accepts each class and nothing else", () => {
    for (const c of INTERNAL_CLASSES) expect(isInternalClass(c)).toBe(true);
    expect(isInternalClass("friend")).toBe(false);
    expect(isInternalClass("")).toBe(false);
    expect(isInternalClass(undefined)).toBe(false);
    expect(isInternalClass(3)).toBe(false);
  });
});

describe("parseAccountIdentifier", () => {
  it("reads an account id, lowercased", () => {
    expect(parseAccountIdentifier("  0F8FAD5B-D9CB-469F-A165-70867728950E ")).toEqual({
      kind: "id",
      id: "0f8fad5b-d9cb-469f-a165-70867728950e",
    });
  });

  it("reads a sign-in address, lowercased", () => {
    expect(parseAccountIdentifier(` ${SYNTHETIC_ADDRESS} `)).toEqual({
      kind: "email",
      email: SYNTHETIC_ADDRESS.toLowerCase(),
    });
  });

  it("refuses anything else", () => {
    expect(parseAccountIdentifier("")).toBeNull();
    expect(parseAccountIdentifier("not an id")).toBeNull();
    expect(parseAccountIdentifier("0f8fad5b-d9cb-469f-a165")).toBeNull();
    expect(parseAccountIdentifier("a@b")).toBeNull();
  });
});

describe("internalListErrorMessage", () => {
  it("names the internal-key rule", () => {
    expect(
      internalListErrorMessage({ code: "23514", message: "internal_key_on_external_account" }),
    ).toBe("That key's account is not on the internal list. Add the account first.");
  });

  it("names an unknown class", () => {
    expect(internalListErrorMessage({ code: "23514", message: "violates check constraint" })).toBe(
      "That is not one of the internal classes.",
    );
  });

  it("names a missing account or key", () => {
    expect(internalListErrorMessage({ code: "23503", message: null })).toBe(
      "No account or key with that id.",
    );
  });

  it("falls back without echoing anything", () => {
    expect(internalListErrorMessage({ code: "XX000", message: "secret detail" })).toBe(
      "That did not save.",
    );
    expect(internalListErrorMessage(null)).toBe("That did not save.");
    expect(internalListErrorMessage(undefined)).toBe("That did not save.");
    expect(internalListErrorMessage({})).toBe("That did not save.");
  });
});

describe("summariseWeek", () => {
  it("counts keys and their trusted reads", () => {
    expect(
      summariseWeek([
        { iso_week: "2026-W45", week_start: "2026-11-02", key_id: "k1", trusted_reads: 3 },
        { iso_week: "2026-W45", week_start: "2026-11-02", key_id: "k2", trusted_reads: "2" },
      ]),
    ).toEqual({ isoWeek: "2026-W45", keys: 2, trustedReads: 5 });
  });

  it("says nothing about the week when there are no rows", () => {
    expect(summariseWeek([])).toEqual({ isoWeek: null, keys: 0, trustedReads: 0 });
  });
});
