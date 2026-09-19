import { validateXHandleInput, trimXHandle, normaliseXHandle } from "./xHandle";

const VALID_WALLET =
  /^0x[a-f0-9]{40}$/i;

export type AdminFcfsImportCategory =
  | "ready"
  | "invalid_wallet"
  | "invalid_handle"
  | "already_in_fcfs"
  | "handle_conflict"
  | "duplicate_in_file"
  | "crossover";

/** Admin manual add / import: X handle is optional; public submit still requires it. */
export function validateAdminFcfsXHandleInput(handle: string): {
  valid: boolean;
  normalised: string | null;
  display: string | null;
  error: string | null;
  provided: boolean;
} {
  const trimmed = trimXHandle(handle);
  if (!trimmed) {
    return {
      valid: true,
      normalised: null,
      display: null,
      error: null,
      provided: false,
    };
  }

  const result = validateXHandleInput(handle);
  return { ...result, provided: true };
}

export function isValidAdminFcfsWallet(wallet: string): boolean {
  return VALID_WALLET.test(wallet.trim().toLowerCase());
}

export function canInsertFromAdminFcfsAudit(audit: {
  outcome: string;
  can_insert?: boolean;
  fcfs_wallet?: { exists?: boolean };
  fcfs_handle?: { exists?: boolean };
}): boolean {
  return audit.outcome === "ok" && audit.can_insert === true;
}

export function classifyAdminFcfsImportRow(input: {
  wallet: string;
  xHandle: string;
  existingWallets: Set<string>;
  existingHandles: Set<string>;
  duplicateWalletInFile: boolean;
  duplicateHandleInFile: boolean;
  wlCrossover: boolean;
}): AdminFcfsImportCategory {
  const wallet = input.wallet.trim().toLowerCase();
  const handleResult = validateAdminFcfsXHandleInput(input.xHandle);
  const handle = handleResult.normalised ?? "";

  if (!isValidAdminFcfsWallet(wallet)) {
    return "invalid_wallet";
  }
  if (handleResult.provided && !handleResult.valid) {
    return "invalid_handle";
  }
  if (input.existingWallets.has(wallet)) {
    return "already_in_fcfs";
  }
  if (handleResult.provided && input.existingHandles.has(handle)) {
    return "handle_conflict";
  }
  if (input.duplicateWalletInFile || (handleResult.provided && input.duplicateHandleInFile)) {
    return "duplicate_in_file";
  }
  if (input.wlCrossover) {
    return "crossover";
  }
  return "ready";
}

export function normaliseAdminFcfsImportHandle(xHandle: string): string | null {
  const trimmed = trimXHandle(xHandle);
  if (!trimmed) return null;
  return normaliseXHandle(trimmed);
}
