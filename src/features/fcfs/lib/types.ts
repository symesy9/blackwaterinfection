export type FcfsApplicationStatus = "pending" | "approved" | "rejected";

export interface FcfsApplication {
  id: string;
  wallet_address: string;
  wallet_address_normalised: string;
  x_handle: string;
  x_handle_normalised: string;
  submitted_at: string;
  follow_opened_at: string | null;
  follow_confirmed_at: string | null;
  share_opened_at: string | null;
  share_confirmed_at: string | null;
  status: FcfsApplicationStatus;
  internal_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FcfsApplicationFilters {
  search?: string;
  status?: FcfsApplicationStatus | "all";
  sortBy?: "submitted_at" | "updated_at" | "x_handle";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface FcfsStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  recent_submissions: number;
}

export type FcfsSubmitOutcome =
  | "submitted"
  | "already_registered"
  | "invalid_wallet"
  | "invalid_x_handle"
  | "incomplete_verification"
  | "invalid_timestamps"
  | "session_expired"
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
