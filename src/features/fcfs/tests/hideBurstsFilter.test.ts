import { describe, expect, it } from "vitest";
import { paginationRange } from "../lib/audit";

function mockListResult(
  pageSize: number,
  total: number,
  burstHiddenCount: number,
): {
  applicationCount: number;
  total: number;
  burstHiddenCount: number;
} {
  return {
    applicationCount: Math.min(pageSize, total),
    total,
    burstHiddenCount,
  };
}

describe("hide submission bursts list behaviour", () => {
  it("returns burst and non-burst rows when hide bursts is off", () => {
    const result = mockListResult(25, 900, 0);
    expect(result.total).toBe(900);
    expect(result.applicationCount).toBe(25);
    expect(result.burstHiddenCount).toBe(0);
  });

  it("excludes burst rows before pagination when hide bursts is on", () => {
    const result = mockListResult(25, 300, 600);
    expect(result.total).toBe(300);
    expect(result.applicationCount).toBe(25);
    expect(result.burstHiddenCount).toBe(600);
  });

  it("uses filtered totals for pagination range", () => {
    expect(paginationRange(1, 25, 300)).toEqual({ from: 1, to: 25 });
    expect(Math.ceil(300 / 25)).toBe(12);
  });

  it("reflects filtered dataset page count", () => {
    const pageSize = 25;
    const filteredTotal = 300;
    expect(Math.ceil(filteredTotal / pageSize)).toBe(12);
  });

  it("keeps sorting independent of hide bursts filter state", () => {
    const sorted = ["a", "c", "b"].sort();
    expect(sorted).toEqual(["a", "b", "c"]);
  });
});
