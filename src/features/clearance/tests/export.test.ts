import { describe, expect, it } from "vitest";
import {
  combinedExportPreview,
  dedupeCombinedExportRows,
} from "../lib/export";
import type { CombinedExportRow } from "../lib/types";

const row = (
  wallet: string,
  overrides: Partial<CombinedExportRow> = {},
): CombinedExportRow => ({
  wallet_address: wallet,
  wallet_address_normalised: wallet.toLowerCase(),
  on_whitelist: false,
  on_fcfs: false,
  wl_mint_allowance: 0,
  fcfs_mint_allowance: 0,
  mint_price_eth: 0.003,
  x_handle: null,
  fcfs_status: null,
  wl_status: null,
  ...overrides,
});

describe("combined export deduplication", () => {
  it("keeps one row per normalized wallet", () => {
    const rows = dedupeCombinedExportRows([
      row("0xABC", { on_whitelist: true, wl_mint_allowance: 1 }),
      row("0xabc", { on_fcfs: true, fcfs_mint_allowance: 2, fcfs_status: "approved" }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].on_whitelist).toBe(true);
    expect(rows[0].on_fcfs).toBe(true);
    expect(rows[0].wl_mint_allowance).toBe(1);
    expect(rows[0].fcfs_mint_allowance).toBe(2);
  });

  it("reports crossover without duplicating wallets", () => {
    const preview = combinedExportPreview([
      row("0x111", { on_whitelist: true, wl_mint_allowance: 1 }),
      row("0x222", { on_fcfs: true, fcfs_mint_allowance: 2, fcfs_status: "approved" }),
      row("0x333", {
        on_whitelist: true,
        on_fcfs: true,
        wl_mint_allowance: 1,
        fcfs_mint_allowance: 2,
        fcfs_status: "approved",
      }),
    ]);

    expect(preview.uniqueWallets).toBe(3);
    expect(preview.wlOnly).toBe(1);
    expect(preview.fcfsOnly).toBe(1);
    expect(preview.crossover).toBe(1);
  });

  it("does not compute effective_mint_allowance", () => {
    const rows = dedupeCombinedExportRows([
      row("0xabc", {
        on_whitelist: true,
        on_fcfs: true,
        wl_mint_allowance: 1,
        fcfs_mint_allowance: 2,
      }),
    ]);

    expect(rows[0]).not.toHaveProperty("effective_mint_allowance");
  });
});
