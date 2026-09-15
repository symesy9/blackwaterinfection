import { describe, expect, it } from "vitest";
import { checkWalletClearance } from "../lib/publicApi";

describe("checkWalletClearance client validation", () => {
  it("returns invalid_address without calling backend for bad input", async () => {
    const result = await checkWalletClearance("not-a-wallet");
    expect(result.outcome).toBe("invalid_address");
  });

  it("returns invalid_address for blank input", async () => {
    const result = await checkWalletClearance("   ");
    expect(result.outcome).toBe("invalid_address");
  });
});
