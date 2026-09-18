import { describe, expect, it } from "vitest";
import {
  buildFcfsSelectionPayload,
  clearSelection,
  reconcileSelectionOnFilterChange,
  selectAllMatching,
  selectPage,
  selectionCount,
  toggleRowSelection,
} from "../lib/selection";

describe("bulk selection", () => {
  it("selects current page", () => {
    const state = selectPage(["1", "2"], "a");
    expect(state.mode).toBe("page");
    expect(state.selectedIds.size).toBe(2);
    expect(selectionCount(state, 2, 100)).toBe(2);
  });

  it("selects all matching filter", () => {
    const state = selectAllMatching("a");
    expect(state.mode).toBe("all_matching");
    expect(selectionCount(state, 25, 846)).toBe(846);
  });

  it("supports exceptions when all matching", () => {
    let state = selectAllMatching("a");
    state = toggleRowSelection(state, "excluded", []);
    expect(state.excludedIds.has("excluded")).toBe(true);
    expect(selectionCount(state, 25, 846)).toBe(845);
  });

  it("clears selection when filters change", () => {
    const state = selectPage(["1"], "old");
    const next = reconcileSelectionOnFilterChange(state, "new");
    expect(next.mode).toBe("none");
  });

  it("builds filter payload for all matching", () => {
    const state = selectAllMatching("snap");
    const payload = buildFcfsSelectionPayload(state, 846);
    expect(payload.selectionMode).toBe("filter");
    expect(payload.expectedCount).toBe(846);
  });

  it("builds ids payload for page selection", () => {
    const state = selectPage(["a", "b"], "snap");
    const payload = buildFcfsSelectionPayload(state, 2);
    expect(payload.selectionMode).toBe("ids");
    expect(payload.ids).toEqual(["a", "b"]);
  });

  it("clears explicitly", () => {
    const state = clearSelection("snap");
    expect(state.mode).toBe("none");
  });
});
