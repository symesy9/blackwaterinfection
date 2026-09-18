import { describe, expect, it } from "vitest";
import {
  bulkDeletePhrase,
  canConfirmBulkDelete,
  formatSelectionChangedMessage,
  shouldAbortOnStaleCount,
  wouldOvercountBurstWindows,
} from "../lib/bulkDeleteSafety";

describe("bulk delete safety", () => {
  it("requires exact DELETE N phrase", () => {
    expect(bulkDeletePhrase(846)).toBe("DELETE 846");
    expect(canConfirmBulkDelete("DELETE 846", 846)).toBe(true);
    expect(canConfirmBulkDelete("DELETE 845", 846)).toBe(false);
    expect(canConfirmBulkDelete("delete 846", 846)).toBe(false);
  });

  it("aborts when stale count differs", () => {
    expect(shouldAbortOnStaleCount(1284, 1284)).toBe(false);
    expect(shouldAbortOnStaleCount(1284, 1287)).toBe(true);
  });

  it("formats selection changed message", () => {
    expect(formatSelectionChangedMessage(1284, 1287)).toContain("SELECTION CHANGED");
    expect(formatSelectionChangedMessage(1284, 1287)).toContain("1284");
    expect(formatSelectionChangedMessage(1284, 1287)).toContain("1287");
  });
});

describe("multi-burst unique counting", () => {
  it("detects overlapping window over-count", () => {
    const summedWindowCounts = 100 + 100 + 100;
    const uniqueApplications = 170;
    expect(wouldOvercountBurstWindows(summedWindowCounts, uniqueApplications)).toBe(
      true,
    );
    expect(wouldOvercountBurstWindows(170, 170)).toBe(false);
  });

  it("unique count must be used for destructive confirmation", () => {
    const summed = 300;
    const unique = 170;
    expect(shouldAbortOnStaleCount(summed, unique)).toBe(true);
    expect(shouldAbortOnStaleCount(unique, unique)).toBe(false);
  });
});
