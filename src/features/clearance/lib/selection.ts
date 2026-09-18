export type SelectionMode = "none" | "page" | "all_matching";

export interface BulkSelectionState {
  mode: SelectionMode;
  selectedIds: Set<string>;
  excludedIds: Set<string>;
  filterSnapshot: string;
}

export function createEmptySelection(filterSnapshot: string): BulkSelectionState {
  return {
    mode: "none",
    selectedIds: new Set(),
    excludedIds: new Set(),
    filterSnapshot,
  };
}

export function selectionCount(
  state: BulkSelectionState,
  _pageTotal: number,
  matchingTotal: number,
): number {
  if (state.mode === "none") return 0;
  if (state.mode === "page") return state.selectedIds.size;
  return Math.max(0, matchingTotal - state.excludedIds.size);
}

export function isRowSelected(state: BulkSelectionState, id: string): boolean {
  if (state.mode === "none") return false;
  if (state.mode === "page") return state.selectedIds.has(id);
  return !state.excludedIds.has(id);
}

export function toggleRowSelection(
  state: BulkSelectionState,
  id: string,
  _pageIds: string[],
): BulkSelectionState {
  if (state.mode === "all_matching") {
    const excludedIds = new Set(state.excludedIds);
    if (excludedIds.has(id)) excludedIds.delete(id);
    else excludedIds.add(id);
    return { ...state, excludedIds };
  }

  const selectedIds = new Set(state.selectedIds);
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);

  const mode: SelectionMode =
    selectedIds.size === 0 ? "none" : "page";

  return { ...state, mode, selectedIds };
}

export function selectPage(
  pageIds: string[],
  filterSnapshot: string,
): BulkSelectionState {
  return {
    mode: "page",
    selectedIds: new Set(pageIds),
    excludedIds: new Set(),
    filterSnapshot,
  };
}

export function selectAllMatching(filterSnapshot: string): BulkSelectionState {
  return {
    mode: "all_matching",
    selectedIds: new Set(),
    excludedIds: new Set(),
    filterSnapshot,
  };
}

export function clearSelection(filterSnapshot: string): BulkSelectionState {
  return createEmptySelection(filterSnapshot);
}

export function reconcileSelectionOnFilterChange(
  state: BulkSelectionState,
  filterSnapshot: string,
): BulkSelectionState {
  if (state.filterSnapshot === filterSnapshot) return state;
  return clearSelection(filterSnapshot);
}

export function buildFcfsSelectionPayload(
  state: BulkSelectionState,
  expectedCount: number,
) {
  if (state.mode === "all_matching") {
    return {
      selectionMode: "filter" as const,
      excludeIds: [...state.excludedIds],
      expectedCount,
      ids: null as string[] | null,
    };
  }
  return {
    selectionMode: "ids" as const,
    ids: [...state.selectedIds],
    excludeIds: [] as string[],
    expectedCount: state.selectedIds.size,
  };
}

export function buildWlSelectionPayload(
  state: BulkSelectionState,
  expectedCount: number,
) {
  return buildFcfsSelectionPayload(state, expectedCount);
}

export function parseBurstWindowsParam(value: string | null): Array<{ start: string; end: string }> {
  if (!value?.trim()) return [];
  return value
    .split(";")
    .map((part) => part.split(","))
    .filter((parts) => parts.length === 2 && parts[0] && parts[1])
    .map(([start, end]) => ({ start: start!, end: end! }));
}

export function burstWindowsToParam(
  windows: Array<{ start: string; end: string }>,
): string | null {
  if (windows.length === 0) return null;
  return windows.map((w) => `${w.start},${w.end}`).join(";");
}
