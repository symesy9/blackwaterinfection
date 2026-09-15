import { invokeEdgeFunction } from "../../whitelist/lib/supabase";
import { validateWalletInput } from "../../whitelist/lib/wallet";
import {
  assertPublicSafeClearancePayload,
  buildClearanceDisplay,
} from "./statusMapping";
import type { ClearanceDisplay, ClearanceLookupRaw } from "./types";

export type ClearanceLookupResult =
  | { outcome: "ok"; display: ClearanceDisplay }
  | { outcome: "invalid_address" }
  | { outcome: "error" | "rate_limited" };

export async function checkWalletClearance(
  address: string,
): Promise<ClearanceLookupResult> {
  const validation = validateWalletInput(address);
  if (!validation.valid) {
    return { outcome: "invalid_address" };
  }

  const raw = await invokeEdgeFunction<ClearanceLookupRaw>(
    "check-wallet-clearance",
    { address: validation.display },
  );

  if (raw.outcome === "invalid_address") {
    return { outcome: "invalid_address" };
  }

  if (raw.outcome === "rate_limited") {
    return { outcome: "rate_limited" };
  }

  if (raw.outcome !== "ok") {
    return { outcome: "error" };
  }

  assertPublicSafeClearancePayload(raw);

  return {
    outcome: "ok",
    display: buildClearanceDisplay(raw, validation.display ?? undefined),
  };
}
