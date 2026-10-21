import { describe, expect, it } from "vitest";
import { signInErrorMessage } from "./sign-in-error";

describe("signInErrorMessage", () => {
  it("replaces the empty 5xx message supabase-js produces", () => {
    expect(signInErrorMessage({ message: "{}", status: 500 })).toMatch(/could not send/);
  });

  it("treats a blank message as a send failure", () => {
    expect(signInErrorMessage({ message: "" })).toMatch(/could not send/);
  });

  it("explains rate limits", () => {
    expect(signInErrorMessage({ message: "email rate limit exceeded", status: 429 })).toMatch(
      /Too many/,
    );
  });

  it("passes a readable 4xx message through", () => {
    expect(signInErrorMessage({ message: "Signups not allowed", status: 422 })).toBe(
      "Signups not allowed",
    );
  });
});
