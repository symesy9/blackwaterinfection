import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearSelection,
  createEmptySelection,
  isRowSelected,
  reconcileSelectionOnFilterChange,
  selectAllMatching,
  selectPage,
  selectionCount,
  toggleRowSelection,
  type BulkSelectionState,
} from "../lib/selection";

export function useBulkSelection(
  pageIds: string[],
  matchingTotal: number,
  filterSnapshot: string,
) {
  const [selection, setSelection] = useState<BulkSelectionState>(() =>
    createEmptySelection(filterSnapshot),
  );

  useEffect(() => {
    setSelection((current) =>
      reconcileSelectionOnFilterChange(current, filterSnapshot),
    );
  }, [filterSnapshot]);

  const count = useMemo(
    () => selectionCount(selection, pageIds.length, matchingTotal),
    [selection, pageIds.length, matchingTotal],
  );

  const toggle = useCallback(
    (id: string) => {
      setSelection((current) => toggleRowSelection(current, id, pageIds));
    },
    [pageIds],
  );

  const selectCurrentPage = useCallback(() => {
    setSelection(selectPage(pageIds, filterSnapshot));
  }, [filterSnapshot, pageIds]);

  const selectMatching = useCallback(() => {
    setSelection(selectAllMatching(filterSnapshot));
  }, [filterSnapshot]);

  const clear = useCallback(() => {
    setSelection(clearSelection(filterSnapshot));
  }, [filterSnapshot]);

  const rowSelected = useCallback(
    (id: string) => isRowSelected(selection, id),
    [selection],
  );

  const allPageSelected =
    pageIds.length > 0 &&
    pageIds.every((id) => isRowSelected(selection, id));

  return {
    selection,
    count,
    toggle,
    selectCurrentPage,
    selectMatching,
    clear,
    rowSelected,
    allPageSelected,
    mode: selection.mode,
    setSelection,
  };
}
