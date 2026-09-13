import { describe, expect, it } from "vitest";
import { approvedWalletsToCsv, fcfsApplicationsToCsv } from "../lib/csv";
import type { FcfsApplication } from "../lib/types";

const sample: FcfsApplication = {
  id: "11111111-1111-1111-1111-111111111111",
  wallet_address: "0xAbCdEf0123456789012345678901234567890AbCd",
  wallet_address_normalised: "0xabcdef0123456789012345678901234567890abcd",
  x_handle: "@testuser",
  x_handle_normalised: "testuser",
  submitted_at: "2026-01-01T12:00:00.000Z",
  follow_opened_at: "2026-01-01T11:59:00.000Z",
  follow_confirmed_at: "2026-01-01T11:59:30.000Z",
  share_opened_at: "2026-01-01T11:59:40.000Z",
  share_confirmed_at: "2026-01-01T11:59:50.000Z",
  status: "approved",
  internal_notes: null,
  reviewed_at: null,
  reviewed_by: null,
  created_at: "2026-01-01T12:00:00.000Z",
  updated_at: "2026-01-01T12:00:00.000Z",
};

describe("fcfs csv", () => {
  it("exports full application rows", () => {
    const csv = fcfsApplicationsToCsv([sample]);
    expect(csv).toContain("wallet_address_normalised");
    expect(csv).toContain(sample.wallet_address_normalised);
    expect(csv).toContain("@testuser");
  });

  it("exports approved wallets only with normalised addresses", () => {
    const csv = approvedWalletsToCsv([
      sample,
      { ...sample, id: "222", status: "pending" },
    ]);

    expect(csv.trim().split("\n")).toHaveLength(2);
    expect(csv).toContain(sample.wallet_address_normalised);
  });
});
