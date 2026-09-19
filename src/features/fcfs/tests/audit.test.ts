import { describe, expect, it } from "vitest";
import {
  computeAuditFlags,
  isBurstInvestigationView,
  isInvalidWalletFormat,
  isMalformedXHandle,
  parseGoToPageInput,
  paginationRange,
  resolveHideBurstsRpcParam,
} from "../lib/audit";
import type { FcfsApplication } from "../lib/types";

const baseApplication: FcfsApplication = {
  id: "11111111-1111-1111-1111-111111111111",
  wallet_address: "0xabcdef0123456789012345678901234567890abcd",
  wallet_address_normalised: "0xabcdef0123456789012345678901234567890abcd",
  x_handle: "@testuser",
  x_handle_normalised: "testuser",
  submitted_at: "2026-01-01T12:00:00.000Z",
  follow_opened_at: null,
  follow_confirmed_at: null,
  share_opened_at: null,
  share_confirmed_at: null,
  status: "pending",
  internal_notes: null,
  reviewed_at: null,
  reviewed_by: null,
  manual_review_flag: false,
  manual_review_reason: null,
  created_at: "2026-01-01T12:00:00.000Z",
  updated_at: "2026-01-01T12:00:00.000Z",
};

describe("fcfs audit helpers", () => {
  it("detects invalid wallet format", () => {
    expect(
      isInvalidWalletFormat("0x19d72c2e078fab2dbc70a664e18061dc06eb0fe3"),
    ).toBe(false);
    expect(isInvalidWalletFormat("not-a-wallet")).toBe(true);
  });

  it("detects malformed x handles", () => {
    expect(isMalformedXHandle("@testuser", "testuser")).toBe(false);
    expect(isMalformedXHandle("TestUser", "testuser")).toBe(true);
    expect(isMalformedXHandle(null, null)).toBe(false);
    expect(isMalformedXHandle("", "")).toBe(false);
  });

  it("computes duplicate x handle flags", () => {
    const flags = computeAuditFlags(baseApplication, {
      duplicateXHandles: new Set(["testuser"]),
      duplicateWallets: new Set(),
    });
    expect(flags).toContain("duplicate_x_handle");
  });

  it("computes already on whitelist flags", () => {
    const flags = computeAuditFlags(baseApplication, {
      duplicateXHandles: new Set(),
      duplicateWallets: new Set(),
      whitelistWallets: new Set([baseApplication.wallet_address_normalised]),
    });
    expect(flags).toContain("already_on_whitelist");
  });

  it("validates go-to-page input", () => {
    expect(parseGoToPageInput("3", 10)).toBe(3);
    expect(parseGoToPageInput("0", 10)).toBeNull();
    expect(parseGoToPageInput("99", 10)).toBeNull();
    expect(parseGoToPageInput("abc", 10)).toBeNull();
  });

  it("builds pagination ranges", () => {
    expect(paginationRange(2, 25, 917)).toEqual({ from: 26, to: 50 });
    expect(paginationRange(1, 25, 0)).toEqual({ from: 0, to: 0 });
  });

  it("detects burst investigation views", () => {
    expect(
      isBurstInvestigationView({
        auditFilter: "submission_burst",
      }),
    ).toBe(true);
    expect(
      isBurstInvestigationView({
        burstStart: "2026-01-01T12:00:00.000Z",
        burstEnd: "2026-01-01T12:02:00.000Z",
      }),
    ).toBe(true);
    expect(isBurstInvestigationView({ hideBursts: true })).toBe(false);
  });

  it("resolves hide bursts RPC param with investigation override", () => {
    expect(resolveHideBurstsRpcParam({ hideBursts: true })).toBe(true);
    expect(resolveHideBurstsRpcParam({ hideBursts: false })).toBe(false);
    expect(
      resolveHideBurstsRpcParam({
        hideBursts: true,
        auditFilter: "submission_burst",
      }),
    ).toBe(false);
    expect(
      resolveHideBurstsRpcParam({
        hideBursts: true,
        burstStart: "2026-01-01T12:00:00.000Z",
        burstEnd: "2026-01-01T12:02:00.000Z",
      }),
    ).toBe(false);
  });

  it("combines status and hide bursts in filter state", () => {
    expect(
      resolveHideBurstsRpcParam({
        hideBursts: true,
        status: "pending",
        search: "gary",
      }),
    ).toBe(true);
  });
});
