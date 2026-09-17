import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FCFS_HIDE_BURSTS_STORAGE_KEY,
  fcfsFiltersToSearchParams,
  parseFcfsFiltersFromSearchParams,
  persistHideBurstsPreference,
} from "../hooks/useFcfsAdminFilters";

function installLocalStorageMock(): void {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  });
}

describe("useFcfsAdminFilters URL helpers", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });
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

  it("round-trips hideBursts through URL state", () => {
    const params = fcfsFiltersToSearchParams({
      page: 1,
      hideBursts: true,
    });
    expect(params.get("hideBursts")).toBe("true");

    const parsed = parseFcfsFiltersFromSearchParams(params);
    expect(parsed.hideBursts).toBe(true);
  });

  it("prefers explicit hideBursts URL param over stored preference", () => {
    persistHideBurstsPreference(true);
    const parsed = parseFcfsFiltersFromSearchParams(
      new URLSearchParams("hideBursts=false"),
    );
    expect(parsed.hideBursts).toBe(false);
  });

  it("restores hideBursts from localStorage when URL omits it", () => {
    persistHideBurstsPreference(true);
    const parsed = parseFcfsFiltersFromSearchParams(new URLSearchParams());
    expect(parsed.hideBursts).toBe(true);
  });

  it("disables hideBursts during burst investigation links", () => {
    persistHideBurstsPreference(true);
    const parsed = parseFcfsFiltersFromSearchParams(
      new URLSearchParams(
        "audit=submission_burst&burstStart=2026-01-01T12:00:00.000Z&burstEnd=2026-01-01T12:02:00.000Z",
      ),
    );
    expect(parsed.hideBursts).toBe(false);
  });

  afterEach(() => {
    localStorage.removeItem(FCFS_HIDE_BURSTS_STORAGE_KEY);
    vi.unstubAllGlobals();
  });
});
