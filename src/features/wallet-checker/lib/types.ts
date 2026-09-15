import type { WalletStatus } from "../../whitelist/lib/types";

export type PublicClearanceStatus =
  | "APPROVED"
  | "PENDING"
  | "NOT APPROVED"
  | "NOT FOUND";

export type FcfsDbStatus = "pending" | "approved" | "rejected";

export interface ClearanceCategoryRaw {
  found: boolean;
  status?: WalletStatus | FcfsDbStatus;
}

export interface ClearanceLookupRaw {
  outcome: "ok" | "invalid_address" | "error" | "rate_limited";
  wallet_address?: string;
  whitelist?: ClearanceCategoryRaw;
  fcfs?: ClearanceCategoryRaw;
}

export interface CategoryClearanceDisplay {
  category: "WHITELIST" | "FCFS";
  publicStatus: PublicClearanceStatus;
  approved: boolean;
  allocation: string | null;
  price: string | null;
  supportingLine: string;
  showFcfsApplyLink: boolean;
  canSelfConfirmWhitelist: boolean;
}

export interface ClearanceDisplay {
  walletAddress: string | null;
  headline: string | null;
  mintPrice: string;
  whitelist: CategoryClearanceDisplay;
  fcfs: CategoryClearanceDisplay;
}
