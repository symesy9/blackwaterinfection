import { describe, expect, it } from "vitest";
import { normaliseWalletAddress } from "../../whitelist/lib/wallet";
import {
  assertPublicSafeClearancePayload,
  buildClearanceDisplay,
  getClearanceHeadline,
  mapFcfsStatus,
  mapWhitelistStatus,
} from "../lib/statusMapping";
import type { ClearanceLookupRaw } from "../lib/types";

const wallet = "0x19d72c2e078fab2dbc70a664e18061dc06eb0fe3";

function raw(
  wl: ClearanceLookupRaw["whitelist"],
  fcfs: ClearanceLookupRaw["fcfs"],
): ClearanceLookupRaw {
  return {
    outcome: "ok",
    wallet_address: wallet,
    whitelist: wl,
    fcfs,
  };
}

describe("mapWhitelistStatus", () => {
  it("maps confirmed to APPROVED with 1 mint allocation", () => {
    const result = mapWhitelistStatus({ found: true, status: "confirmed" });
    expect(result.publicStatus).toBe("APPROVED");
    expect(result.approved).toBe(true);
    expect(result.allocation).toBe("1 MINT");
    expect(result.price).toBe("0.003 ETH");
  });

  it("maps unconfirmed to PENDING without allocation", () => {
    const result = mapWhitelistStatus({ found: true, status: "unconfirmed" });
    expect(result.publicStatus).toBe("PENDING");
    expect(result.approved).toBe(false);
    expect(result.allocation).toBeNull();
    expect(result.canSelfConfirmWhitelist).toBe(true);
  });

  it("maps needs_review to PENDING", () => {
    const result = mapWhitelistStatus({ found: true, status: "needs_review" });
    expect(result.publicStatus).toBe("PENDING");
    expect(result.canSelfConfirmWhitelist).toBe(false);
  });

  it("maps not found", () => {
    const result = mapWhitelistStatus({ found: false });
    expect(result.publicStatus).toBe("NOT FOUND");
  });

  it("maps removed as NOT APPROVED when found with removed status", () => {
    const result = mapWhitelistStatus({ found: true, status: "removed" });
    expect(result.publicStatus).toBe("NOT APPROVED");
  });
});

describe("mapFcfsStatus", () => {
  it("maps approved to APPROVED with up to 2 mints", () => {
    const result = mapFcfsStatus({ found: true, status: "approved" });
    expect(result.publicStatus).toBe("APPROVED");
    expect(result.allocation).toBe("UP TO 2 MINTS");
    expect(result.price).toBe("0.003 ETH EACH");
  });

  it("maps pending to PENDING without allocation", () => {
    const result = mapFcfsStatus({ found: true, status: "pending" });
    expect(result.publicStatus).toBe("PENDING");
    expect(result.allocation).toBeNull();
  });

  it("maps rejected to NOT APPROVED", () => {
    const result = mapFcfsStatus({ found: true, status: "rejected" });
    expect(result.publicStatus).toBe("NOT APPROVED");
  });

  it("maps not found with FCFS apply link", () => {
    const result = mapFcfsStatus({ found: false });
    expect(result.publicStatus).toBe("NOT FOUND");
    expect(result.showFcfsApplyLink).toBe(true);
  });
});

describe("combined clearance scenarios", () => {
  it("WL approved + FCFS approved → CLEARANCE FOUND", () => {
    const display = buildClearanceDisplay(
      raw(
        { found: true, status: "confirmed" },
        { found: true, status: "approved" },
      ),
    );
    expect(display.headline).toBe("CLEARANCE FOUND");
    expect(display.whitelist.approved).toBe(true);
    expect(display.fcfs.approved).toBe(true);
  });

  it("WL approved + FCFS pending", () => {
    const display = buildClearanceDisplay(
      raw(
        { found: true, status: "confirmed" },
        { found: true, status: "pending" },
      ),
    );
    expect(display.whitelist.publicStatus).toBe("APPROVED");
    expect(display.fcfs.publicStatus).toBe("PENDING");
    expect(display.headline).toBe("CLEARANCE FOUND");
  });

  it("WL approved + FCFS not found", () => {
    const display = buildClearanceDisplay(
      raw({ found: true, status: "confirmed" }, { found: false }),
    );
    expect(display.whitelist.approved).toBe(true);
    expect(display.fcfs.publicStatus).toBe("NOT FOUND");
    expect(display.fcfs.showFcfsApplyLink).toBe(true);
  });

  it("WL pending + FCFS approved", () => {
    const display = buildClearanceDisplay(
      raw(
        { found: true, status: "unconfirmed" },
        { found: true, status: "approved" },
      ),
    );
    expect(display.whitelist.publicStatus).toBe("PENDING");
    expect(display.fcfs.approved).toBe(true);
  });

  it("WL not found + FCFS approved", () => {
    const display = buildClearanceDisplay(
      raw({ found: false }, { found: true, status: "approved" }),
    );
    expect(display.whitelist.publicStatus).toBe("NOT FOUND");
    expect(display.fcfs.approved).toBe(true);
    expect(getClearanceHeadline(display.whitelist, display.fcfs)).toBe(
      "CLEARANCE FOUND",
    );
  });

  it("WL not found + FCFS pending", () => {
    const display = buildClearanceDisplay(
      raw({ found: false }, { found: true, status: "pending" }),
    );
    expect(display.whitelist.publicStatus).toBe("NOT FOUND");
    expect(display.fcfs.publicStatus).toBe("PENDING");
  });

  it("neither found → NO CLEARANCE FOUND", () => {
    const display = buildClearanceDisplay(
      raw({ found: false }, { found: false }),
    );
    expect(display.headline).toBe("NO CLEARANCE FOUND");
    expect(display.fcfs.showFcfsApplyLink).toBe(true);
  });
});

describe("public payload safety", () => {
  it("rejects payloads that expose admin/internal fields", () => {
    expect(() =>
      assertPublicSafeClearancePayload({
        outcome: "ok",
        whitelist: { found: true, status: "confirmed" },
        fcfs: { found: false },
        internal_notes: "secret",
      } as ClearanceLookupRaw),
    ).toThrow(/forbidden field/);
  });

  it("allows minimal public-safe clearance payload", () => {
    expect(() =>
      assertPublicSafeClearancePayload(
        raw({ found: true, status: "confirmed" }, { found: false }),
      ),
    ).not.toThrow();
  });
});

describe("wallet normalisation", () => {
  it("normalises addresses case-insensitively for lookup consistency", () => {
    expect(normaliseWalletAddress(wallet.toUpperCase())).toBe(
      normaliseWalletAddress(wallet),
    );
  });
});
