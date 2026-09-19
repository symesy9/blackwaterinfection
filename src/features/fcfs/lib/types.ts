export type FcfsApplicationStatus = "pending" | "approved" | "rejected";

export type FcfsAuditFlag =
  | "manual_review"
  | "duplicate_x_handle"
  | "duplicate_wallet"
  | "already_on_whitelist"
  | "malformed_x_handle"
  | "invalid_wallet_format"
  | "submission_burst";

export type FcfsAuditFilter =
  | "all"
  | "flagged"
  | "no_flags"
  | "pending"
  | "approved"
  | "rejected"
  | "manual_review"
  | "duplicate_x_handle"
  | "duplicate_wallet"
  | "already_on_whitelist"
  | "invalid_wallet"
  | "malformed_x_handle"
  | "submission_burst";

export type FcfsSortField =
  | "submitted_at"
  | "updated_at"
  | "x_handle"
  | "wallet"
  | "status";

export type ManualReviewReason =
  | "X ACCOUNT NOT FOUND"
  | "VERY LOW ACTIVITY"
  | "SUSPICIOUS HANDLE"
  | "SUSPICIOUS SUBMISSION PATTERN"
  | "WALLET ISSUE"
  | "OTHER";

export interface FcfsApplication {
  id: string;
  wallet_address: string;
  wallet_address_normalised: string;
  x_handle: string | null;
  x_handle_normalised: string | null;
  submitted_at: string;
  follow_opened_at: string | null;
  follow_confirmed_at: string | null;
  share_opened_at: string | null;
  share_confirmed_at: string | null;
  status: FcfsApplicationStatus;
  internal_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  manual_review_flag: boolean;
  manual_review_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface FcfsApplicationEnriched extends FcfsApplication {
  audit_flags: FcfsAuditFlag[];
  duplicate_x_handle_count: number;
  same_burst_count: number;
  already_on_whitelist?: boolean;
}

export interface FcfsApplicationFilters {
  search?: string;
  status?: FcfsApplicationStatus | "all";
  auditFilter?: FcfsAuditFilter;
  sortBy?: FcfsSortField;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  burstStart?: string | null;
  burstEnd?: string | null;
  burstWindows?: Array<{ start: string; end: string }>;
  xHandleNormalised?: string | null;
  selectedId?: string | null;
  hideBursts?: boolean;
}

export interface FcfsApplicationsListResult {
  applications: FcfsApplicationEnriched[];
  total: number;
  burstHiddenCount: number;
}

export interface FcfsStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  recent_submissions: number;
}

export interface FcfsAuditSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  manual_review_flagged: number;
  flagged_for_review: number;
  duplicate_x_handles: number;
  duplicate_wallets: number;
  invalid_wallet_format: number;
  malformed_x_handle: number;
  submission_burst_periods: number;
}

export interface FcfsBurstWindow {
  bucket_start: string;
  bucket_end: string;
  application_count: number;
}

export interface FcfsTimelinePeriod {
  period_start: string;
  application_count: number;
}

export interface FcfsRelatedApplicationSummary {
  id: string;
  wallet_address: string;
  status: FcfsApplicationStatus;
  submitted_at: string;
}

export interface FcfsRelatedCounts {
  same_x_handle_count: number;
  same_wallet_count: number;
  same_burst_count: number;
  x_handle_normalised: string;
  on_whitelist: boolean;
  whitelist_status: string | null;
  related_x_handle_applications: FcfsRelatedApplicationSummary[];
}

export interface FcfsWalletAuditApplication {
  application: FcfsApplication;
  audit_flags: FcfsAuditFlag[];
  duplicate_x_handle_count: number;
}

export interface FcfsWalletAuditResult {
  outcome: "ok" | "invalid_wallet";
  wallet_address_normalised?: string;
  fcfs_applications?: FcfsWalletAuditApplication[];
  whitelist_record?: Record<string, unknown> | null;
  on_whitelist?: boolean;
}

export interface FcfsDataAuditSummary {
  total_fcfs_applications: number;
  duplicate_wallet_groups: number;
  duplicate_x_handle_groups: number;
  duplicate_x_handle_applications: number;
  fcfs_wallets_on_whitelist: number;
  invalid_wallet_format_count: number;
  malformed_x_handle_count: number;
  submission_burst_application_count: number;
  wallet_unique_constraint_present: boolean;
  x_handle_unique_index_present: boolean;
}

export type FcfsSubmitOutcome =
  | "submitted"
  | "already_registered"
  | "x_handle_already_used"
  | "invalid_wallet"
  | "invalid_x_handle"
  | "incomplete_verification"
  | "invalid_timestamps"
  | "session_expired"
  | "turnstile_failed"
  | "turnstile_expired"
  | "error"
  | "rate_limited";

export interface FcfsSubmitResult {
  outcome: FcfsSubmitOutcome;
  application_id?: string;
  submitted_at?: string;
}

export interface ManualFcfsInput {
  wallet_address: string;
  x_handle: string;
  status?: FcfsApplicationStatus;
  internal_notes?: string;
  follow_opened_at?: string;
  follow_confirmed_at?: string;
  share_opened_at?: string;
  share_confirmed_at?: string;
}
