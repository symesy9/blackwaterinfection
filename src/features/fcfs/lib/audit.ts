import { isValidEvmWalletAddress } from "../../whitelist/lib/wallet";
import { validateXHandleInput } from "./xHandle";
import type { FcfsApplication, FcfsAuditFlag } from "./types";

export const FCFS_BURST_WINDOW_MINUTES = 2;
export const FCFS_BURST_MIN_COUNT = 5;

export function isInvalidWalletFormat(walletNormalised: string): boolean {
  return !isValidEvmWalletAddress(walletNormalised);
}

export function isMalformedXHandle(
  xHandle: string,
  xHandleNormalised: string,
): boolean {
  const validation = validateXHandleInput(xHandleNormalised);
  if (!validation.valid) return true;
  return xHandle.trim().toLowerCase() !== `@${xHandleNormalised.toLowerCase()}`;
}

export function computeAuditFlags(
  application: FcfsApplication,
  context: {
    duplicateXHandles: Set<string>;
    duplicateWallets: Set<string>;
    burstTimestamps?: Set<number>;
  },
): FcfsAuditFlag[] {
  const flags: FcfsAuditFlag[] = [];

  if (application.manual_review_flag) {
    flags.push("manual_review");
  }
  if (context.duplicateXHandles.has(application.x_handle_normalised)) {
    flags.push("duplicate_x_handle");
  }
  if (context.duplicateWallets.has(application.wallet_address_normalised)) {
    flags.push("duplicate_wallet");
  }
  if (isMalformedXHandle(application.x_handle, application.x_handle_normalised)) {
    flags.push("malformed_x_handle");
  }
  if (isInvalidWalletFormat(application.wallet_address_normalised)) {
    flags.push("invalid_wallet_format");
  }
  if (context.burstTimestamps?.has(Date.parse(application.submitted_at))) {
    flags.push("submission_burst");
  }

  return flags;
}

export function auditFlagLabel(flag: FcfsAuditFlag): string {
  switch (flag) {
    case "manual_review":
      return "Flagged for review";
    case "duplicate_x_handle":
      return "Duplicate X handle";
    case "duplicate_wallet":
      return "Duplicate wallet";
    case "malformed_x_handle":
      return "Malformed X handle";
    case "invalid_wallet_format":
      return "Invalid address format";
    case "submission_burst":
      return "Submission burst";
    default:
      return flag;
  }
}

export function parseGoToPageInput(
  raw: string,
  totalPages: number,
): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const page = Number.parseInt(trimmed, 10);
  if (page < 1 || page > totalPages) return null;
  return page;
}

export function paginationRange(
  page: number,
  pageSize: number,
  total: number,
): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return { from, to };
}
