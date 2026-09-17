import { describe, expect, it } from "vitest";
import { approvedWalletsToCsv, fcfsApplicationsToCsv } from "../lib/csv";
import type { FcfsApplicationEnriched } from "../lib/types";

const sample: FcfsApplicationEnriched = {
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
  manual_review_flag: false,
  manual_review_reason: null,
  created_at: "2026-01-01T12:00:00.000Z",
  updated_at: "2026-01-01T12:00:00.000Z",
  audit_flags: ["already_on_whitelist"],
  duplicate_x_handle_count: 2,
  same_burst_count: 0,
  already_on_whitelist: true,
};

describe("fcfs csv", () => {
  it("exports full application rows with audit fields", () => {
    const csv = fcfsApplicationsToCsv([sample]);
    expect(csv).toContain("already_on_whitelist");
    expect(csv).toContain("same_x_handle_application_count");
    expect(csv).toContain("fcfs_status");
    expect(csv).toContain("audit_flags");
    expect(csv).toContain(sample.wallet_address_normalised);
    expect(csv).toContain("@testuser");
    expect(csv).toContain("yes");
    expect(csv).toContain("Already on WL");
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
