import { describe, expect, it } from "vitest";
import {
  fcfsFiltersToSearchParams,
  parseFcfsFiltersFromSearchParams,
} from "../hooks/useFcfsAdminFilters";

describe("useFcfsAdminFilters URL helpers", () => {
  it("round-trips list state through search params", () => {
    const params = fcfsFiltersToSearchParams({
      page: 12,
      pageSize: 25,
      search: "gary",
      status: "pending",
      auditFilter: "flagged",
      sortBy: "x_handle",
      sortDir: "asc",
      burstStart: "2026-01-01T12:00:00.000Z",
      burstEnd: "2026-01-01T12:02:00.000Z",
      xHandleNormalised: "gary2003",
      selectedId: "11111111-1111-1111-1111-111111111111",
    });

    const parsed = parseFcfsFiltersFromSearchParams(params);
    expect(parsed.page).toBe(12);
    expect(parsed.search).toBe("gary");
    expect(parsed.status).toBe("pending");
    expect(parsed.auditFilter).toBe("flagged");
    expect(parsed.sortBy).toBe("x_handle");
    expect(parsed.sortDir).toBe("asc");
    expect(parsed.burstStart).toBe("2026-01-01T12:00:00.000Z");
    expect(parsed.xHandleNormalised).toBe("gary2003");
    expect(parsed.selectedId).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("falls back safely for invalid query params", () => {
    const parsed = parseFcfsFiltersFromSearchParams(
      new URLSearchParams("page=0&sort=invalid&audit=not-real&direction=sideways"),
    );
    expect(parsed.page).toBe(1);
    expect(parsed.sortBy).toBe("submitted_at");
    expect(parsed.auditFilter).toBe("all");
    expect(parsed.sortDir).toBe("desc");
  });
});
