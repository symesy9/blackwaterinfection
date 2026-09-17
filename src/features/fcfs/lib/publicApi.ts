import { invokeEdgeFunction } from "../../whitelist/lib/supabase";
import type { FcfsSubmitResult } from "./types";
import { formatXHandleDisplay } from "./xHandle";
import { validateWalletInput } from "../../whitelist/lib/wallet";
import { validateXHandleInput } from "./xHandle";

export const FCFS_HONEYPOT_FIELD = "company_website";

export interface FcfsSubmissionPayload {
  wallet_address: string;
  x_handle: string;
  follow_opened_at: string;
  follow_confirmed_at: string;
  share_opened_at: string;
  share_confirmed_at: string;
  turnstile_token: string;
  [FCFS_HONEYPOT_FIELD]?: string;
}

export async function submitFcfsApplication(
  payload: FcfsSubmissionPayload,
): Promise<FcfsSubmitResult> {
  const walletValidation = validateWalletInput(payload.wallet_address);
  if (!walletValidation.valid) {
    return { outcome: "invalid_wallet" };
  }

  const handleValidation = validateXHandleInput(payload.x_handle);
  if (!handleValidation.valid) {
    return { outcome: "invalid_x_handle" };
  }

  if (!payload.turnstile_token.trim()) {
    return { outcome: "turnstile_failed" };
  }

  return invokeEdgeFunction<FcfsSubmitResult>("submit-fcfs-application", {
    wallet_address: walletValidation.display,
    x_handle: formatXHandleDisplay(handleValidation.normalised ?? ""),
    follow_opened_at: payload.follow_opened_at,
    follow_confirmed_at: payload.follow_confirmed_at,
    share_opened_at: payload.share_opened_at,
    share_confirmed_at: payload.share_confirmed_at,
    turnstile_token: payload.turnstile_token,
    [FCFS_HONEYPOT_FIELD]: payload[FCFS_HONEYPOT_FIELD] ?? "",
  });
}
