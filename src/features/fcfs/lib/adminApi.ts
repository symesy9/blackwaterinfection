import { getSupabase } from "../../whitelist/lib/supabase";
import { copyToClipboard } from "../../whitelist/lib/adminApi";
import {
  isValidEvmWalletAddress,
  normaliseWalletAddress,
  preserveDisplayAddress,
} from "../../whitelist/lib/wallet";
import type {
  FcfsApplication,
  FcfsApplicationFilters,
  FcfsApplicationStatus,
  FcfsStats,
  ManualFcfsInput,
} from "./types";
import { formatXHandleDisplay, normaliseXHandle, validateXHandleInput } from "./xHandle";

export { copyToClipboard };

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

export async function fetchFcfsApplications(
  filters: FcfsApplicationFilters = {},
): Promise<{ applications: FcfsApplication[]; total: number }> {
  const supabase = getSupabase();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("fcfs_applications").select("*", { count: "exact" });

  if (filters.search?.trim()) {
    const term = filters.search.trim().toLowerCase().replace(/^@+/, "");
    query = query.or(
      `wallet_address_normalised.ilike.%${term}%,x_handle_normalised.ilike.%${term}%`,
    );
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const sortBy = filters.sortBy ?? "submitted_at";
  const ascending = filters.sortDir === "asc";
  query = query.order(sortBy, { ascending, nullsFirst: false });
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    applications: (data ?? []) as FcfsApplication[],
    total: count ?? 0,
  };
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
  return data as FcfsApplication | null;
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
  return data as FcfsApplication | null;
}

export async function fetchAllFcfsApplicationsForExport(): Promise<FcfsApplication[]> {
  const supabase = getSupabase();
  const all: FcfsApplication[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("fcfs_applications")
      .select("*")
      .order("submitted_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    all.push(...(data as FcfsApplication[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

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

  return { application: data as FcfsApplication, duplicate: false };
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

  return data as FcfsApplication;
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
