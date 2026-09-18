import type { WhitelistWallet } from "../../whitelist/lib/types";

export type WlAuditFilter =
  | "all"
  | "duplicate_wallet"
  | "also_in_fcfs"
  | "manual_review"
  | "clean";

export type WlAuditFlag =
  | "duplicate_wl_wallet"
  | "also_in_fcfs"
  | "manual_review";

export interface WlApplicationEnriched {
  wallet: WhitelistWallet;
  audit_flags: WlAuditFlag[];
  also_in_fcfs: boolean;
}

export interface WlListResult {
  wallets: WlApplicationEnriched[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClearanceOverview {
  whitelist: { total: number; active: number };
  fcfs: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    flagged: number;
  };
  combined: {
    wallet_crossover: number;
    wl_only: number;
    fcfs_only: number;
    unique_wallets: number;
  };
  security: {
    duplicate_fcfs_handle_groups: number;
    identity_conflicts: number;
  };
}

export type CrossListView =
  | "all"
  | "crossover"
  | "wl_only"
  | "fcfs_only"
  | "duplicates"
  | "clean";

export interface CrossListRow {
  wallet_address_normalised: string;
  wl_records: number;
  fcfs_records: number;
  wl_status: string | null;
  fcfs_status: string | null;
  fcfs_handles: string | null;
  is_crossover: boolean;
  entitlement: string;
  audit_flags: string[];
}

export interface CrossListResult {
  rows: CrossListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClearanceBurstWindow {
  bucket_start: string;
  bucket_end: string;
  application_count: number;
  unique_wallets: number;
  unique_handles: number;
  flagged_count: number;
  pending_count?: number;
  approved_count?: number;
  rejected_count?: number;
}

export type FcfsBulkOperation =
  | "flag_review"
  | "clear_review"
  | "approve"
  | "reject"
  | "pending"
  | "delete";

export type WlBulkOperation =
  | "flag_review"
  | "clear_review"
  | "activate"
  | "deactivate"
  | "delete";

export interface WlPreInsertAudit {
  outcome: string;
  wallet_address_normalised?: string;
  whitelist?: { exists: boolean; status?: string; is_active?: boolean };
  fcfs?: { exists: boolean; status?: string; x_handle?: string };
  crossover?: { valid_crossover?: boolean; blocked_duplicate_wl?: boolean };
  can_insert?: boolean;
}

export interface FcfsPreInsertAudit {
  outcome: string;
  wallet_address_normalised?: string;
  x_handle_normalised?: string;
  whitelist?: { exists: boolean };
  fcfs_wallet?: { exists: boolean; status?: string };
  fcfs_handle?: { exists: boolean; wallet?: string };
  crossover?: { valid_crossover?: boolean };
  can_insert?: boolean;
}

export interface ImportPreviewResult {
  outcome: string;
  summary: {
    total: number;
    ready: number;
    invalid_wallet: number;
    invalid_handle: number;
    duplicate_in_file: number;
    already_in_wl: number;
    already_in_fcfs: number;
    crossover: number;
    handle_conflict: number;
  };
  rows: Array<Record<string, unknown>>;
}

export type ClearanceExportType =
  | "whitelist_only"
  | "fcfs_approved_only"
  | "combined_mint_ready";

export interface CombinedExportRow {
  wallet_address: string;
  wallet_address_normalised: string;
  on_whitelist: boolean;
  on_fcfs: boolean;
  wl_mint_allowance: number;
  fcfs_mint_allowance: number;
  mint_price_eth: number;
  x_handle: string | null;
  fcfs_status: string | null;
  wl_status: string | null;
}

export interface ClearanceExportResult {
  outcome: string;
  export_type: ClearanceExportType;
  total: number;
  rows: CombinedExportRow[];
}

export interface HandleLookupResult {
  outcome: string;
  x_handle_normalised?: string;
  fcfs_applications?: Array<{
    application: Record<string, unknown>;
    on_whitelist: boolean;
  }>;
  identity_conflict?: boolean;
  wl_records?: unknown[];
}
