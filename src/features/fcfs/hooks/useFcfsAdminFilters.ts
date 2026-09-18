import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  burstWindowsToParam,
  parseBurstWindowsParam,
} from "../../clearance/lib/selection";
import { isBurstInvestigationView } from "../lib/audit";
import type {
  FcfsApplicationFilters,
  FcfsAuditFilter,
  FcfsApplicationStatus,
  FcfsSortField,
} from "../lib/types";

const DEFAULT_PAGE_SIZE = 25;
export const FCFS_HIDE_BURSTS_STORAGE_KEY = "bw-fcfs-hide-bursts";

const SORT_FIELDS: FcfsSortField[] = [
  "submitted_at",
  "updated_at",
  "x_handle",
  "wallet",
  "status",
];

const AUDIT_FILTERS: FcfsAuditFilter[] = [
  "all",
  "flagged",
  "no_flags",
  "pending",
  "approved",
  "rejected",
  "manual_review",
  "duplicate_x_handle",
  "duplicate_wallet",
  "already_on_whitelist",
  "invalid_wallet",
  "malformed_x_handle",
  "submission_burst",
];

const STATUS_VALUES: Array<FcfsApplicationStatus | "all"> = [
  "all",
  "pending",
  "approved",
  "rejected",
];

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : fallback;
}

function parseEnum<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (!value) return fallback;
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function readStoredHideBurstsPreference(): boolean {
  try {
    return localStorage.getItem(FCFS_HIDE_BURSTS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function persistHideBurstsPreference(enabled: boolean): void {
  try {
    localStorage.setItem(
      FCFS_HIDE_BURSTS_STORAGE_KEY,
      enabled ? "true" : "false",
    );
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

function parseHideBursts(params: URLSearchParams): boolean {
  const partialFilters = {
    auditFilter: parseEnum(params.get("audit"), AUDIT_FILTERS, "all"),
    burstStart: params.get("burstStart"),
    burstEnd: params.get("burstEnd"),
  };
  if (isBurstInvestigationView(partialFilters)) {
    return false;
  }

  const urlParam = params.get("hideBursts");
  if (urlParam === "true") return true;
  if (urlParam === "false") return false;
  return readStoredHideBurstsPreference();
}

export function parseFcfsFiltersFromSearchParams(
  params: URLSearchParams,
): FcfsApplicationFilters {
  return {
    page: parsePositiveInt(params.get("page"), 1),
    pageSize: Math.min(
      parsePositiveInt(params.get("pageSize"), DEFAULT_PAGE_SIZE),
      100,
    ),
    search: params.get("search") ?? "",
    status: parseEnum(params.get("status"), STATUS_VALUES, "all"),
    auditFilter: parseEnum(params.get("audit"), AUDIT_FILTERS, "all"),
    sortBy: parseEnum(params.get("sort"), SORT_FIELDS, "submitted_at"),
    sortDir: params.get("direction") === "asc" ? "asc" : "desc",
    burstStart: params.get("burstStart"),
    burstEnd: params.get("burstEnd"),
    burstWindows: parseBurstWindowsParam(params.get("bursts")),
    xHandleNormalised: params.get("xHandle"),
    selectedId: params.get("id"),
    hideBursts: parseHideBursts(params),
  };
}

export function fcfsFiltersToSearchParams(
  filters: FcfsApplicationFilters,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.page && filters.page !== 1) {
    params.set("page", String(filters.page));
  }
  if (filters.pageSize && filters.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(filters.pageSize));
  }
  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.auditFilter && filters.auditFilter !== "all") {
    params.set("audit", filters.auditFilter);
  }
  if (filters.sortBy && filters.sortBy !== "submitted_at") {
    params.set("sort", filters.sortBy);
  }
  if (filters.sortDir === "asc") {
    params.set("direction", "asc");
  }
  if (filters.burstWindows && filters.burstWindows.length > 0) {
    const bursts = burstWindowsToParam(filters.burstWindows);
    if (bursts) params.set("bursts", bursts);
  } else {
    if (filters.burstStart) {
      params.set("burstStart", filters.burstStart);
    }
    if (filters.burstEnd) {
      params.set("burstEnd", filters.burstEnd);
    }
  }
  if (filters.xHandleNormalised) {
    params.set("xHandle", filters.xHandleNormalised);
  }
  if (filters.selectedId) {
    params.set("id", filters.selectedId);
  }
  if (filters.hideBursts) {
    params.set("hideBursts", "true");
  }

  return params;
}

export function useFcfsAdminFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => parseFcfsFiltersFromSearchParams(searchParams),
    [searchParams],
  );

  const setFilters = useCallback(
    (
      updater:
        | FcfsApplicationFilters
        | ((current: FcfsApplicationFilters) => FcfsApplicationFilters),
    ) => {
      setSearchParams((currentParams) => {
        const current = parseFcfsFiltersFromSearchParams(currentParams);
        const next =
          typeof updater === "function" ? updater(current) : updater;
        if (next.hideBursts !== current.hideBursts) {
          persistHideBurstsPreference(Boolean(next.hideBursts));
        }
        return fcfsFiltersToSearchParams(next);
      });
    },
    [setSearchParams],
  );

  return { filters, setFilters };
}

export { DEFAULT_PAGE_SIZE as FCFS_DEFAULT_PAGE_SIZE };
