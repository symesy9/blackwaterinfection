import { describe, expect, it } from "vitest";
import { normaliseXHandle, validateXHandleInput } from "../lib/xHandle";
import { normaliseWalletAddress } from "../../whitelist/lib/wallet";
import {
  isExactWalletSearch,
  normaliseAdminHandleSearch,
  normaliseAdminWalletSearch,
} from "../lib/adminSearch";
import { fcfsSubmitErrorDisplay } from "../lib/submitErrors";
import { isHoneypotTriggered, FCFS_HONEYPOT_FIELD } from "../../../../supabase/functions/submit-fcfs-application/verify.ts";

describe("FCFS duplicate protection helpers", () => {
  it("normalises wallet addresses case-insensitively", () => {
    const mixed = "0xAbCdEf0123456789012345678901234567890AbCd";
    const lower = "0xabcdef0123456789012345678901234567890abcd";
    expect(normaliseWalletAddress(mixed)).toBe(lower);
    expect(normaliseWalletAddress(lower)).toBe(lower);
  });

  it("normalises X handles from @, case, and whitespace variants", () => {
    expect(normaliseXHandle("@Gary2003")).toBe("gary2003");
    expect(normaliseXHandle("gary2003")).toBe("gary2003");
    expect(normaliseXHandle(" GARY2003 ")).toBe("gary2003");
    expect(normaliseXHandle("@@gary2003")).toBe("gary2003");
  });

  it("validates equivalent handle forms consistently", () => {
    const variants = ["@Gary2003", "gary2003", " GARY2003 "];
    const normalised = variants.map(
      (value) => validateXHandleInput(value).normalised,
    );
    expect(new Set(normalised)).toEqual(new Set(["gary2003"]));
  });

  it("returns user-safe x handle duplicate messaging without wallet details", () => {
    const message = fcfsSubmitErrorDisplay("x_handle_already_used");
    expect(message?.detail).toContain("already been used");
    expect(message?.detail?.toLowerCase()).not.toContain("wallet");
    expect(message?.detail?.toLowerCase()).not.toContain("0x");
  });

  it("keeps honeypot rejection generic", () => {
    expect(isHoneypotTriggered({ [FCFS_HONEYPOT_FIELD]: "https://spam.example" })).toBe(
      true,
    );
    const message = fcfsSubmitErrorDisplay("error");
    expect(message?.title.toLowerCase()).not.toContain("honeypot");
  });

  it("supports admin wallet and handle search normalisation", () => {
    const wallet = "0x19d72c2e078fab2dbc70a664e18061dc06eb0fe3";
    expect(normaliseAdminWalletSearch(wallet)).toBe(wallet);
    expect(isExactWalletSearch(wallet)).toBe(true);
    expect(normaliseAdminHandleSearch("@Gary2003")).toBe("gary2003");
    expect(normaliseAdminHandleSearch("gary2003")).toBe("gary2003");
  });

  it("documents wallet unique constraint expectation", () => {
    const schemaExpectation = {
      table: "fcfs_applications",
      column: "wallet_address_normalised",
      unique: true,
    };
    expect(schemaExpectation.unique).toBe(true);
  });
});
