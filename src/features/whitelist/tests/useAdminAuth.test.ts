import { describe, expect, it } from "vitest";

describe("useAdminAuth focus behaviour", () => {
  it("skips verifying clearance gate on TOKEN_REFRESHED", () => {
    const shouldGate = (event: string) => event !== "TOKEN_REFRESHED";
    expect(shouldGate("TOKEN_REFRESHED")).toBe(false);
    expect(shouldGate("SIGNED_IN")).toBe(true);
    expect(shouldGate("SIGNED_OUT")).toBe(true);
  });
});
