import { getSupabase } from "../../whitelist/lib/supabase";
import { copyToClipboard } from "../../whitelist/lib/adminApi";
import {
  isValidEvmWalletAddress,
  normaliseWalletAddress,
  preserveDisplayAddress,
} from "../../whitelist/lib/wallet";
import type {
  FcfsApplication,
  FcfsApplicationEnriched,
  FcfsApplicationFilters,
  FcfsApplicationsListResult,
  FcfsApplicationStatus,
  FcfsAuditFlag,
  FcfsAuditSummary,
  FcfsBurstWindow,
  FcfsDataAuditSummary,
  FcfsRelatedCounts,
  FcfsWalletAuditResult,
  FcfsStats,
  FcfsTimelinePeriod,
  ManualFcfsInput,
  ManualReviewReason,
} from "./types";
import { resolveHideBurstsRpcParam } from "./audit";
import { formatXHandleDisplay, normaliseXHandle, validateXHandleInput } from "./xHandle";

export { copyToClipboard };

function normalizeFcfsApplication(row: Record<string, unknown>): FcfsApplication {
  const application = row as unknown as FcfsApplication;
  return {
    ...application,
    manual_review_flag: Boolean(row.manual_review_flag ?? false),
    manual_review_reason: (row.manual_review_reason as string | null) ?? null,
  };
}

function mapEnrichedRow(row: {
  application: Record<string, unknown>;
  audit_flags?: FcfsAuditFlag[];
  duplicate_x_handle_count?: number;
  same_burst_count?: number;
  already_on_whitelist?: boolean;
}): FcfsApplicationEnriched {
  return {
    ...normalizeFcfsApplication(row.application),
    audit_flags: row.audit_flags ?? [],
    duplicate_x_handle_count: row.duplicate_x_handle_count ?? 1,
    same_burst_count: row.same_burst_count ?? 0,
    already_on_whitelist: Boolean(row.already_on_whitelist),
  };
}

export async function getFcfsStats(): Promise<FcfsStats> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_fcfs_stats");
  if (error) throw error;
  return data as FcfsStats;
}

export async function fetchDuplicateXHandles(): Promise<Set<string>> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_fcfs_duplicate_x_handles");
  if (error) throw error;
  return new Set((data ?? []) as string[]);
}

function resolveAuditFilter(filters: FcfsApplicationFilters): string {
  return filters.auditFilter ?? "all";
}

export async function fetchFcfsApplicationsEnriched(
  filters: FcfsApplicationFilters = {},
): Promise<FcfsApplicationsListResult> {
  const supabase = getSupabase();
  const auditFilter = resolveAuditFilter(filters);

  const { data, error } = await supabase.rpc("admin_fcfs_list", {
    p_page: filters.page ?? 1,
    p_page_size: filters.pageSize ?? 25,
    p_search: filters.search?.trim() || null,
    p_status: filters.status ?? "all",
    p_sort: filters.sortBy ?? "submitted_at",
    p_sort_dir: filters.sortDir ?? "desc",
    p_audit_filter: auditFilter,
    p_burst_start: filters.burstStart ?? null,
    p_burst_end: filters.burstEnd ?? null,
    p_x_handle_normalised: filters.xHandleNormalised ?? null,
    p_hide_bursts: resolveHideBurstsRpcParam(filters),
  });

  if (error) {
    console.error("admin_fcfs_list RPC error", error);
    throw error;
  }

  const payload = data as {
    applications?: Array<{
      application: Record<string, unknown>;
      audit_flags?: FcfsAuditFlag[];
      duplicate_x_handle_count?: number;
      same_burst_count?: number;
      already_on_whitelist?: boolean;
    }>;
    total?: number;
    burst_hidden_count?: number;
  };

  return {
    applications: (payload.applications ?? []).map(mapEnrichedRow),
    total: payload.total ?? 0,
    burstHiddenCount: payload.burst_hidden_count ?? 0,
  };
}

export async function fetchFcfsApplications(
  filters: FcfsApplicationFilters = {},
): Promise<{ applications: FcfsApplication[]; total: number }> {
  const result = await fetchFcfsApplicationsEnriched(filters);
  return {
    applications: result.applications,
    total: result.total,
  };
}

export async function getFcfsAuditSummary(): Promise<FcfsAuditSummary> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_fcfs_audit_summary");
  if (error) throw error;
  return data as FcfsAuditSummary;
}

export async function fetchFcfsBurstWindows(): Promise<FcfsBurstWindow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_fcfs_burst_buckets", {
    p_window_minutes: 2,
    p_min_count: 5,
  });
  if (error) throw error;
  return (data ?? []) as FcfsBurstWindow[];
}

export async function fetchFcfsSubmissionTimeline(
  granularity: "day" | "hour" | "minute" = "hour",
): Promise<FcfsTimelinePeriod[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_fcfs_submission_timeline", {
    p_granularity: granularity,
  });
  if (error) throw error;
  const payload = data as { periods?: FcfsTimelinePeriod[] };
  return payload.periods ?? [];
}

export async function fetchFcfsRelatedCounts(
  applicationId: string,
): Promise<FcfsRelatedCounts | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_fcfs_related_counts", {
    p_application_id: applicationId,
  });
  if (error) throw error;
  if (!data || Object.keys(data as object).length === 0) return null;
  const payload = data as FcfsRelatedCounts;
  return {
    same_x_handle_count: payload.same_x_handle_count ?? 0,
    same_wallet_count: payload.same_wallet_count ?? 1,
    same_burst_count: payload.same_burst_count ?? 0,
    x_handle_normalised: payload.x_handle_normalised ?? "",
    on_whitelist: Boolean(payload.on_whitelist),
    whitelist_status: payload.whitelist_status ?? null,
    related_x_handle_applications: payload.related_x_handle_applications ?? [],
  };
}

export async function fetchFcfsWalletAudit(
  wallet: string,
): Promise<FcfsWalletAuditResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_fcfs_wallet_audit", {
    p_wallet: wallet.trim(),
  });
  if (error) throw error;
  const payload = data as FcfsWalletAuditResult;
  return {
    ...payload,
    fcfs_applications: (payload.fcfs_applications ?? []).map((row) => ({
      application: normalizeFcfsApplication(
        row.application as unknown as Record<string, unknown>,
      ),
      audit_flags: row.audit_flags ?? [],
      duplicate_x_handle_count: row.duplicate_x_handle_count ?? 1,
    })),
  };
}

export async function fetchFcfsDataAudit(): Promise<FcfsDataAuditSummary> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_fcfs_data_audit");
  if (error) throw error;
  return data as FcfsDataAuditSummary;
}

export async function fetchFcfsApplicationById(
  id: string,
): Promise<FcfsApplication | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("fcfs_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeFcfsApplication(data as Record<string, unknown>) : null;
}

export async function fetchFcfsApplicationByWallet(
  normalised: string,
): Promise<FcfsApplication | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("fcfs_applications")
    .select("*")
    .eq("wallet_address_normalised", normalised)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeFcfsApplication(data as Record<string, unknown>) : null;
}

export async function fetchAllFcfsApplicationsForExport(
  filters: FcfsApplicationFilters = {},
): Promise<FcfsApplicationEnriched[]> {
  const all: FcfsApplicationEnriched[] = [];
  const pageSize = 100;
  let page = 1;
  let total = 0;

  do {
    const result = await fetchFcfsApplicationsEnriched({
      ...filters,
      page,
      pageSize,
    });
    all.push(...result.applications);
    total = result.total;
    page += 1;
  } while (all.length < total);

  return all;
}

async function logFcfsAudit(
  eventType: string,
  applicationId: string,
  walletAddress: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("log_fcfs_admin_audit", {
    p_event_type: eventType,
    p_fcfs_application_id: applicationId,
    p_wallet_address: walletAddress,
    p_metadata: metadata,
  });

  if (error) {
    console.error("FCFS audit log failed", error);
  }
}

export async function createFcfsApplicationManual(
  input: ManualFcfsInput,
): Promise<{ application: FcfsApplication | null; duplicate: boolean }> {
  if (!isValidEvmWalletAddress(input.wallet_address)) {
    throw new Error("Invalid wallet address.");
  }

  const handleValidation = validateXHandleInput(input.x_handle);
  if (!handleValidation.valid || !handleValidation.normalised) {
    throw new Error(handleValidation.error ?? "Invalid X handle.");
  }

  const walletNormalised = normaliseWalletAddress(input.wallet_address);
  const existing = await fetchFcfsApplicationByWallet(walletNormalised);
  if (existing) {
    return { application: existing, duplicate: true };
  }

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date().toISOString();
  const followOpened = input.follow_opened_at ?? now;
  const followConfirmed = input.follow_confirmed_at ?? now;
  const shareOpened = input.share_opened_at ?? now;
  const shareConfirmed = input.share_confirmed_at ?? now;

  const { data, error } = await supabase
    .from("fcfs_applications")
    .insert({
      wallet_address: preserveDisplayAddress(input.wallet_address),
      wallet_address_normalised: walletNormalised,
      x_handle: formatXHandleDisplay(handleValidation.normalised),
      x_handle_normalised: handleValidation.normalised,
      submitted_at: now,
      follow_opened_at: followOpened,
      follow_confirmed_at: followConfirmed,
      share_opened_at: shareOpened,
      share_confirmed_at: shareConfirmed,
      status: input.status ?? "pending",
      internal_notes: input.internal_notes ?? null,
      reviewed_by: input.status && input.status !== "pending" ? user?.id ?? null : null,
      reviewed_at: input.status && input.status !== "pending" ? now : null,
    })
    .select()
    .single();

  if (error) throw error;

  await logFcfsAudit("fcfs_application_created_manual", data.id, data.wallet_address, {
    x_handle: data.x_handle,
    status: data.status,
  });

  return {
    application: normalizeFcfsApplication(data as Record<string, unknown>),
    duplicate: false,
  };
}

export async function updateFcfsApplication(
  id: string,
  updates: Partial<
    Pick<
      FcfsApplication,
      | "status"
      | "internal_notes"
      | "wallet_address"
      | "wallet_address_normalised"
      | "x_handle"
      | "x_handle_normalised"
      | "follow_opened_at"
      | "follow_confirmed_at"
      | "share_opened_at"
      | "share_confirmed_at"
      | "reviewed_at"
      | "reviewed_by"
      | "manual_review_flag"
      | "manual_review_reason"
    >
  >,
  auditType = "fcfs_application_edited",
): Promise<FcfsApplication> {
  const supabase = getSupabase();
  const existing = await fetchFcfsApplicationById(id);
  if (!existing) throw new Error("Application not found.");

  if (
    updates.wallet_address_normalised &&
    updates.wallet_address_normalised !== existing.wallet_address_normalised
  ) {
    const conflict = await fetchFcfsApplicationByWallet(updates.wallet_address_normalised);
    if (conflict && conflict.id !== id) {
      throw new Error("Another FCFS application already uses this wallet.");
    }
  }

  const { data, error } = await supabase
    .from("fcfs_applications")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  await logFcfsAudit(auditType, id, data.wallet_address, {
    before: { status: existing.status, x_handle: existing.x_handle },
    after: { status: data.status, x_handle: data.x_handle },
  });

  return normalizeFcfsApplication(data as Record<string, unknown>);
}

export async function setFcfsManualReviewFlag(
  id: string,
  flagged: boolean,
  reason: ManualReviewReason | string | null = null,
): Promise<FcfsApplication> {
  return updateFcfsApplication(
    id,
    {
      manual_review_flag: flagged,
      manual_review_reason: flagged ? reason : null,
    },
    flagged ? "fcfs_manual_review_flagged" : "fcfs_manual_review_cleared",
  );
}

export async function bulkSetFcfsManualReviewFlag(
  ids: string[],
  flagged: boolean,
  reason: ManualReviewReason | string | null = null,
): Promise<number> {
  if (ids.length === 0) return 0;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("fcfs_applications")
    .update({
      manual_review_flag: flagged,
      manual_review_reason: flagged ? reason : null,
    })
    .in("id", ids)
    .select("id");

  if (error) throw error;

  const updated = data?.length ?? 0;
  if (updated > 0 && data?.[0]?.id) {
    await logFcfsAudit(
      flagged ? "fcfs_bulk_manual_review_flagged" : "fcfs_bulk_manual_review_cleared",
      data[0].id,
      "",
      { updated, reason: flagged ? reason : null },
    );
  }

  return updated;
}

export async function countPendingFcfsApplications(): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("fcfs_applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) throw error;
  return count ?? 0;
}

export async function approveAllPendingFcfsApplications(): Promise<number> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const reviewedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("fcfs_applications")
    .update({
      status: "approved",
      reviewed_at: reviewedAt,
      reviewed_by: user?.id ?? null,
    })
    .eq("status", "pending")
    .select("id");

  if (error) throw error;

  const approved = data?.length ?? 0;

  if (approved > 0) {
    await logFcfsAudit("fcfs_bulk_approve_all", data![0]!.id, "", {
      approved,
      reviewed_at: reviewedAt,
    });
  }

  return approved;
}

export async function setFcfsApplicationStatus(
  id: string,
  status: FcfsApplicationStatus,
): Promise<FcfsApplication> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const auditType =
    status === "approved"
      ? "fcfs_application_approved"
      : status === "rejected"
        ? "fcfs_application_rejected"
        : "fcfs_application_pending";

  return updateFcfsApplication(
    id,
    {
      status,
      reviewed_at: status === "pending" ? null : new Date().toISOString(),
      reviewed_by: status === "pending" ? null : user?.id ?? null,
    },
    auditType,
  );
}

export async function updateFcfsWalletAndHandle(
  id: string,
  walletAddress: string,
  xHandle: string,
): Promise<FcfsApplication> {
  if (!isValidEvmWalletAddress(walletAddress)) {
    throw new Error("Invalid wallet address.");
  }

  const handleValidation = validateXHandleInput(xHandle);
  if (!handleValidation.valid || !handleValidation.normalised) {
    throw new Error(handleValidation.error ?? "Invalid X handle.");
  }

  const walletNormalised = normaliseWalletAddress(walletAddress);

  return updateFcfsApplication(id, {
    wallet_address: preserveDisplayAddress(walletAddress),
    wallet_address_normalised: walletNormalised,
    x_handle: formatXHandleDisplay(handleValidation.normalised),
    x_handle_normalised: normaliseXHandle(handleValidation.normalised),
  });
}
