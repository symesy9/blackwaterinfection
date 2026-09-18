import { resolveHideBurstsRpcParam } from "../../fcfs/lib/audit";
import type { FcfsApplicationFilters } from "../../fcfs/lib/types";
import { getSupabase } from "../../whitelist/lib/supabase";
import type { WalletFilters, WhitelistWallet } from "../../whitelist/lib/types";
import { burstWindowsToParam } from "./selection";
import type {
  ClearanceBurstWindow,
  ClearanceExportResult,
  ClearanceExportType,
  ClearanceOverview,
  CrossListResult,
  CrossListView,
  FcfsBulkOperation,
  FcfsPreInsertAudit,
  HandleLookupResult,
  ImportPreviewResult,
  WlApplicationEnriched,
  WlAuditFilter,
  WlBulkOperation,
  WlListResult,
  WlPreInsertAudit,
} from "./types";

function mapWlRow(row: {
  wallet: Record<string, unknown>;
  audit_flags?: string[];
  also_in_fcfs?: boolean;
}): WlApplicationEnriched {
  return {
    wallet: row.wallet as unknown as WhitelistWallet,
    audit_flags: (row.audit_flags ?? []) as WlApplicationEnriched["audit_flags"],
    also_in_fcfs: Boolean(row.also_in_fcfs),
  };
}

export function fcfsFiltersToRpcParams(filters: FcfsApplicationFilters) {
  const burstWindows =
    filters.burstWindows && filters.burstWindows.length > 0
      ? filters.burstWindows.map((window) => ({
          start: window.start,
          end: window.end,
        }))
      : null;

  return {
    p_search: filters.search?.trim() || null,
    p_status: filters.status ?? "all",
    p_audit_filter: filters.auditFilter ?? "all",
    p_burst_start: filters.burstStart ?? null,
    p_burst_end: filters.burstEnd ?? null,
    p_burst_windows: burstWindows,
    p_x_handle_normalised: filters.xHandleNormalised ?? null,
    p_hide_bursts: resolveHideBurstsRpcParam(filters),
  };
}

export function wlFiltersToRpcParams(
  filters: WalletFilters & { auditFilter?: WlAuditFilter },
) {
  return {
    p_search: filters.search?.trim() || null,
    p_status: filters.status ?? "all",
    p_active_state: filters.activeState ?? "all",
    p_audit_filter: filters.auditFilter ?? "all",
    p_source: filters.source ?? null,
    p_batch_id: filters.batchId ?? null,
  };
}

export function fcfsFilterSnapshot(filters: FcfsApplicationFilters): string {
  return JSON.stringify({
    ...filters,
    selectedId: undefined,
    burstWindowsParam: burstWindowsToParam(filters.burstWindows ?? []),
  });
}

export function wlFilterSnapshot(
  filters: WalletFilters & { auditFilter?: WlAuditFilter },
): string {
  return JSON.stringify(filters);
}

export async function fetchClearanceOverview(): Promise<ClearanceOverview> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_clearance_overview");
  if (error) throw error;
  return data as ClearanceOverview;
}

export async function fetchWlApplicationsEnriched(
  filters: WalletFilters & { auditFilter?: WlAuditFilter } = {},
): Promise<WlListResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_wl_list", {
    p_page: filters.page ?? 1,
    p_page_size: filters.pageSize ?? 25,
    ...wlFiltersToRpcParams(filters),
    p_sort:
      filters.sortBy === "wallet_address_normalised"
        ? "wallet"
        : filters.sortBy ?? "created_at",
    p_sort_dir: filters.sortDir ?? "desc",
  });

  if (error) throw error;

  const payload = data as {
    wallets?: Array<{
      wallet: Record<string, unknown>;
      audit_flags?: string[];
      also_in_fcfs?: boolean;
    }>;
    total?: number;
    page?: number;
    page_size?: number;
  };

  return {
    wallets: (payload.wallets ?? []).map(mapWlRow),
    total: payload.total ?? 0,
    page: payload.page ?? 1,
    pageSize: payload.page_size ?? 25,
  };
}

export async function fetchFcfsBurstSelectionCount(
  burstWindows: Array<{ start: string; end: string }>,
): Promise<number> {
  const supabase = getSupabase();
  const payload = burstWindows.map((window) => ({
    start: window.start,
    end: window.end,
  }));
  const { data, error } = await supabase.rpc("admin_fcfs_burst_selection_count", {
    p_burst_windows: payload,
  });
  if (error) throw error;
  const result = data as { count?: number; unique_applications?: number };
  return result.unique_applications ?? result.count ?? 0;
}

export async function fetchFcfsSelectionCount(
  filters: FcfsApplicationFilters,
  excludeIds: string[] = [],
): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_fcfs_selection_count", {
    ...fcfsFiltersToRpcParams(filters),
    p_exclude_ids: excludeIds.length > 0 ? excludeIds : null,
  });
  if (error) throw error;
  return (data as { count?: number }).count ?? 0;
}

export async function fetchWlSelectionCount(
  filters: WalletFilters & { auditFilter?: WlAuditFilter },
  excludeIds: string[] = [],
): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_wl_selection_count", {
    ...wlFiltersToRpcParams(filters),
    p_exclude_ids: excludeIds.length > 0 ? excludeIds : null,
  });
  if (error) throw error;
  return (data as { count?: number }).count ?? 0;
}

export async function fcfsBulkAction(
  operation: FcfsBulkOperation,
  filters: FcfsApplicationFilters,
  options: {
    selectionMode: "ids" | "filter";
    ids?: string[];
    excludeIds?: string[];
    expectedCount?: number;
    manualReviewReason?: string | null;
    selectionLabel?: string;
  },
): Promise<{ outcome: string; affected?: number; expected?: number; current?: number }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_fcfs_bulk_action", {
    p_operation: operation,
    p_selection_mode: options.selectionMode,
    p_expected_count: options.expectedCount ?? null,
    p_ids: options.ids?.length ? options.ids : null,
    p_exclude_ids: options.excludeIds?.length ? options.excludeIds : null,
    ...fcfsFiltersToRpcParams(filters),
    p_manual_review_reason: options.manualReviewReason ?? null,
    p_selection_label: options.selectionLabel ?? null,
  });
  if (error) throw error;
  return data as {
    outcome: string;
    affected?: number;
    expected?: number;
    current?: number;
  };
}

export async function wlBulkAction(
  operation: WlBulkOperation,
  filters: WalletFilters & { auditFilter?: WlAuditFilter },
  options: {
    selectionMode: "ids" | "filter";
    ids?: string[];
    excludeIds?: string[];
    expectedCount?: number;
    selectionLabel?: string;
  },
): Promise<{ outcome: string; affected?: number; expected?: number; current?: number }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_wl_bulk_action", {
    p_operation: operation,
    p_selection_mode: options.selectionMode,
    p_expected_count: options.expectedCount ?? null,
    p_ids: options.ids?.length ? options.ids : null,
    p_exclude_ids: options.excludeIds?.length ? options.excludeIds : null,
    ...wlFiltersToRpcParams(filters),
    p_selection_label: options.selectionLabel ?? null,
  });
  if (error) throw error;
  return data as {
    outcome: string;
    affected?: number;
    expected?: number;
    current?: number;
  };
}

export async function fetchWlPreInsertAudit(wallet: string): Promise<WlPreInsertAudit> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_wl_pre_insert_audit", {
    p_wallet: wallet,
  });
  if (error) throw error;
  return data as WlPreInsertAudit;
}

export async function fetchFcfsPreInsertAudit(
  wallet: string,
  xHandle: string,
): Promise<FcfsPreInsertAudit> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_fcfs_pre_insert_audit", {
    p_wallet: wallet,
    p_x_handle: xHandle,
  });
  if (error) throw error;
  return data as FcfsPreInsertAudit;
}

export async function createFcfsManualRpc(input: {
  wallet: string;
  xHandle: string;
  status?: string;
  notes?: string | null;
}): Promise<{ outcome: string; application?: Record<string, unknown> }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_fcfs_create_manual", {
    p_wallet: input.wallet,
    p_x_handle: input.xHandle,
    p_status: input.status ?? "pending",
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return data as { outcome: string; application?: Record<string, unknown> };
}

export async function fetchCrossListWallets(
  view: CrossListView = "crossover",
  page = 1,
  pageSize = 25,
): Promise<CrossListResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_clearance_cross_list_wallets", {
    p_page: page,
    p_page_size: pageSize,
    p_view: view,
  });
  if (error) throw error;
  return data as CrossListResult;
}

export async function fetchCrossListFcfsHandles(
  view = "duplicates",
  page = 1,
  pageSize = 25,
) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_clearance_cross_list_fcfs_handles", {
    p_page: page,
    p_page_size: pageSize,
    p_view: view,
  });
  if (error) throw error;
  return data as {
    rows: Array<Record<string, unknown>>;
    total: number;
    wl_handles_available: boolean;
  };
}

export async function fetchClearanceBurstWindows(
  windowMinutes = 5,
  minCount = 5,
): Promise<ClearanceBurstWindow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_clearance_burst_windows", {
    p_window_minutes: windowMinutes,
    p_min_count: minCount,
  });
  if (error) throw error;
  const payload = data as { windows?: ClearanceBurstWindow[] };
  return payload.windows ?? [];
}

export async function fetchClearanceExport(
  exportType: ClearanceExportType,
): Promise<ClearanceExportResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_clearance_export", {
    p_export_type: exportType,
  });
  if (error) throw error;
  return data as ClearanceExportResult;
}

export async function fetchClearanceExportV2(
  config: Record<string, unknown>,
): Promise<ClearanceExportResult & { unique_wallets?: number }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_clearance_export_v2", {
    p_config: config,
  });
  if (error) throw error;
  return data as ClearanceExportResult & { unique_wallets?: number };
}

export async function fetchHandleLookup(handle: string): Promise<HandleLookupResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_clearance_handle_lookup", {
    p_handle: handle,
  });
  if (error) throw error;
  return data as HandleLookupResult;
}

export async function previewClearanceImport(
  dataset: "whitelist" | "fcfs",
  rows: Array<Record<string, unknown>>,
): Promise<ImportPreviewResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_clearance_import_preview", {
    p_dataset: dataset,
    p_rows: rows,
  });
  if (error) throw error;
  return data as ImportPreviewResult;
}

export async function commitClearanceImport(
  dataset: "whitelist" | "fcfs",
  rows: Array<Record<string, unknown>>,
  expectedCount: number,
  batchName: string,
): Promise<{ outcome: string; imported?: number; ready?: number }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_clearance_import_commit", {
    p_dataset: dataset,
    p_rows: rows,
    p_expected_count: expectedCount,
    p_batch_name: batchName,
  });
  if (error) throw error;
  return data as { outcome: string; imported?: number; ready?: number };
}
