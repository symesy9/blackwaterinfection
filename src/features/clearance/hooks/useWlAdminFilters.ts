import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { WalletFilters } from "../../whitelist/lib/types";
import type { WlAuditFilter } from "../lib/types";

const DEFAULT_PAGE_SIZE = 25;

const AUDIT_FILTERS: WlAuditFilter[] = [
  "all",
  "duplicate_wallet",
  "also_in_fcfs",
  "manual_review",
  "clean",
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

export function wlFiltersToSearchParams(
  filters: WalletFilters & { auditFilter?: WlAuditFilter },
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.activeState && filters.activeState !== "all") {
    params.set("active", filters.activeState);
  }
  if (filters.auditFilter && filters.auditFilter !== "all") {
    params.set("audit", filters.auditFilter);
  }
  if (filters.sortBy && filters.sortBy !== "created_at") {
    params.set("sort", filters.sortBy === "wallet_address_normalised" ? "wallet" : filters.sortBy);
  }
  if (filters.source) params.set("source", filters.source);
  if (filters.batchId) params.set("batch", filters.batchId);
  if (filters.sortDir && filters.sortDir !== "desc") {
    params.set("dir", filters.sortDir);
  }
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  if (filters.pageSize && filters.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(filters.pageSize));
  }
  return params;
}

export function useWlAdminFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo((): WalletFilters & { auditFilter?: WlAuditFilter } => {
    const sort = searchParams.get("sort") ?? "created_at";
    const sortBy =
      sort === "wallet"
        ? ("wallet_address_normalised" as WalletFilters["sortBy"])
        : (["created_at", "confirmed_at", "updated_at"].includes(sort)
            ? (sort as WalletFilters["sortBy"])
            : "created_at");

    return {
      search: searchParams.get("search") ?? "",
      status: (searchParams.get("status") as WalletFilters["status"]) ?? "all",
      activeState:
        (searchParams.get("active") as WalletFilters["activeState"]) ?? "all",
      auditFilter: parseEnum(
        searchParams.get("audit"),
        AUDIT_FILTERS,
        "all",
      ),
      source: searchParams.get("source") ?? undefined,
      batchId: searchParams.get("batch") ?? undefined,
      sortBy,
      sortDir: searchParams.get("dir") === "asc" ? "asc" : "desc",
      page: parsePositiveInt(searchParams.get("page"), 1),
      pageSize: parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (
      updater:
        | (WalletFilters & { auditFilter?: WlAuditFilter })
        | ((
            current: WalletFilters & { auditFilter?: WlAuditFilter },
          ) => WalletFilters & { auditFilter?: WlAuditFilter }),
    ) => {
      setSearchParams((current) => {
        const sort = current.get("sort") ?? "created_at";
        const prev: WalletFilters & { auditFilter?: WlAuditFilter } = {
          search: current.get("search") ?? "",
          status: (current.get("status") as WalletFilters["status"]) ?? "all",
          activeState:
            (current.get("active") as WalletFilters["activeState"]) ?? "all",
          auditFilter: parseEnum(current.get("audit"), AUDIT_FILTERS, "all"),
          source: current.get("source") ?? undefined,
          batchId: current.get("batch") ?? undefined,
          sortBy:
            sort === "wallet"
              ? "wallet_address_normalised"
              : (["created_at", "confirmed_at", "updated_at"].includes(sort)
                  ? (sort as WalletFilters["sortBy"])
                  : "created_at"),
          sortDir: current.get("dir") === "asc" ? "asc" : "desc",
          page: parsePositiveInt(current.get("page"), 1),
          pageSize: parsePositiveInt(current.get("pageSize"), DEFAULT_PAGE_SIZE),
        };
        const next = typeof updater === "function" ? updater(prev) : updater;
        return wlFiltersToSearchParams(next);
      });
    },
    [setSearchParams],
  );

  return { filters, setFilters };
}
