import type { FcfsSubmitOutcome } from "./types";

export interface FcfsSubmitErrorDisplay {
  title: string;
  detail?: string;
}

export function fcfsSubmitErrorDisplay(
  outcome: FcfsSubmitOutcome,
): FcfsSubmitErrorDisplay | null {
  switch (outcome) {
    case "turnstile_failed":
      return {
        title: "SECURITY CHECK FAILED",
        detail: "Please complete the security check and try again.",
      };
    case "turnstile_expired":
      return {
        title: "SECURITY CHECK EXPIRED",
        detail: "Please verify again before submitting.",
      };
    case "already_registered":
      return { title: "WALLET ALREADY REGISTERED" };
    case "rate_limited":
      return {
        title: "Too many attempts",
        detail: "Please wait a moment and try again.",
      };
    case "invalid_wallet":
    case "invalid_x_handle":
    case "incomplete_verification":
    case "invalid_timestamps":
    case "session_expired":
      return {
        title: "Unable to submit application",
        detail: "Check your details and try again.",
      };
    case "error":
      return {
        title: "Unable to submit application",
        detail: "Please try again.",
      };
    default:
      return null;
  }
}
