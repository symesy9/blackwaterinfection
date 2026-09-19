import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { submitFcfsApplication } from "../lib/publicApi";
import { validateXHandleInput } from "../lib/xHandle";
import {
  canInsertFromAdminFcfsAudit,
  classifyAdminFcfsImportRow,
  validateAdminFcfsXHandleInput,
} from "../lib/adminManual";

const WALLET = "0x19d72c2e078fab2dbc70a664e18061dc06eb0fe3";
const OTHER_WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("admin FCFS manual add — optional X handle", () => {
  it("allows wallet-only manual add validation (blank X)", () => {
    const result = validateAdminFcfsXHandleInput("");
    expect(result.valid).toBe(true);
    expect(result.provided).toBe(false);
    expect(result.normalised).toBeNull();
    expect(result.error).toBeNull();
  });

  it("allows wallet + valid X handle", () => {
    const result = validateAdminFcfsXHandleInput("@blackwater_z26");
    expect(result.valid).toBe(true);
    expect(result.provided).toBe(true);
    expect(result.normalised).toBe("blackwater_z26");
  });

  it("blank X does not trigger invalid-X error", () => {
    const blank = validateAdminFcfsXHandleInput("");
    expect(blank.error).toBeNull();
    expect(blank.valid).toBe(true);
    expect(validateXHandleInput("").valid).toBe(false);
  });

  it("blocks duplicate wallet from audit result", () => {
    expect(
      canInsertFromAdminFcfsAudit({
        outcome: "ok",
        can_insert: false,
        fcfs_wallet: { exists: true },
      }),
    ).toBe(false);
  });

  it("allows insert when wallet is new and X omitted", () => {
    expect(
      canInsertFromAdminFcfsAudit({
        outcome: "ok",
        can_insert: true,
        fcfs_wallet: { exists: false },
        fcfs_handle: { exists: false },
      }),
    ).toBe(true);
  });

  it("blocks supplied duplicate X from audit result", () => {
    expect(
      canInsertFromAdminFcfsAudit({
        outcome: "ok",
        can_insert: false,
        fcfs_wallet: { exists: false },
        fcfs_handle: { exists: true },
      }),
    ).toBe(false);
  });
});

describe("admin FCFS CSV import — optional X handle", () => {
  it("classifies wallet-only row as ready", () => {
    expect(
      classifyAdminFcfsImportRow({
        wallet: WALLET,
        xHandle: "",
        existingWallets: new Set(),
        existingHandles: new Set(),
        duplicateWalletInFile: false,
        duplicateHandleInFile: false,
        wlCrossover: false,
      }),
    ).toBe("ready");
  });

  it("classifies duplicate wallet as blocked", () => {
    expect(
      classifyAdminFcfsImportRow({
        wallet: WALLET,
        xHandle: "",
        existingWallets: new Set([WALLET.toLowerCase()]),
        existingHandles: new Set(),
        duplicateWalletInFile: false,
        duplicateHandleInFile: false,
        wlCrossover: false,
      }),
    ).toBe("already_in_fcfs");
  });

  it("classifies WL crossover without rejecting wallet-only row", () => {
    expect(
      classifyAdminFcfsImportRow({
        wallet: WALLET,
        xHandle: "",
        existingWallets: new Set(),
        existingHandles: new Set(),
        duplicateWalletInFile: false,
        duplicateHandleInFile: false,
        wlCrossover: true,
      }),
    ).toBe("crossover");
  });

  it("still blocks duplicate X when supplied", () => {
    expect(
      classifyAdminFcfsImportRow({
        wallet: OTHER_WALLET,
        xHandle: "@takenhandle",
        existingWallets: new Set(),
        existingHandles: new Set(["takenhandle"]),
        duplicateWalletInFile: false,
        duplicateHandleInFile: false,
        wlCrossover: false,
      }),
    ).toBe("handle_conflict");
  });
});

describe("public FCFS submit — X handle still required", () => {
  it("rejects missing X handle before calling the Edge Function", async () => {
    const result = await submitFcfsApplication({
      wallet_address: WALLET,
      x_handle: "",
      follow_opened_at: "2026-01-01T12:00:00.000Z",
      follow_confirmed_at: "2026-01-01T12:00:01.000Z",
      share_opened_at: "2026-01-01T12:00:02.000Z",
      share_confirmed_at: "2026-01-01T12:00:03.000Z",
      turnstile_token: "token",
    });
    expect(result.outcome).toBe("invalid_x_handle");
  });
});

describe("012 admin FCFS optional x handle migration", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/012_admin_fcfs_optional_x_handle.sql"),
    "utf8",
  );

  it("allows nullable x_handle columns", () => {
    expect(migration).toMatch(/ALTER COLUMN x_handle DROP NOT NULL/);
    expect(migration).toMatch(/ALTER COLUMN x_handle_normalised DROP NOT NULL/);
  });

  it("uses conditional partial unique index when no duplicate handles", () => {
    expect(migration).toMatch(/HAVING count\(\*\) > 1/);
    expect(migration).toMatch(/WHERE x_handle_normalised IS NOT NULL/);
  });

  it("skips handle validation when blank in pre-insert audit", () => {
    expect(migration).toMatch(/v_handle_provided/);
    expect(migration).toMatch(/IF v_handle_provided AND v_handle !~/);
  });

  it("does not modify public_submit_fcfs_application", () => {
    expect(migration).not.toMatch(/public_submit_fcfs_application/);
  });
});
