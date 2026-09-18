import { describe, expect, it } from "vitest";
import { wlFiltersToSearchParams } from "../hooks/useWlAdminFilters";

describe("wlFiltersToSearchParams", () => {
  it("persists audit filter and page in URL", () => {
    const params = wlFiltersToSearchParams({
      auditFilter: "also_in_fcfs",
      page: 3,
      pageSize: 25,
      sortBy: "created_at",
      sortDir: "desc",
      status: "all",
      activeState: "all",
    });

    expect(params.get("audit")).toBe("also_in_fcfs");
    expect(params.get("page")).toBe("3");
  });

  it("maps wallet sort to URL token", () => {
    const params = wlFiltersToSearchParams({
      sortBy: "wallet_address_normalised",
      sortDir: "asc",
      page: 1,
      pageSize: 25,
      status: "all",
      activeState: "all",
    });

    expect(params.get("sort")).toBe("wallet");
    expect(params.get("dir")).toBe("asc");
  });
});
