export function bulkDeletePhrase(count: number): string {
  return `DELETE ${count}`;
}

export function canConfirmBulkDelete(phrase: string, count: number): boolean {
  return phrase === bulkDeletePhrase(count);
}

export function shouldAbortOnStaleCount(
  expected: number,
  current: number,
): boolean {
  return expected !== current;
}

/** Sum of per-window counts can over-count when windows overlap. */
export function wouldOvercountBurstWindows(
  summedWindowCounts: number,
  uniqueApplicationCount: number,
): boolean {
  return summedWindowCounts > uniqueApplicationCount;
}

export function formatSelectionChangedMessage(
  expected: number,
  current: number,
): string {
  return `SELECTION CHANGED — Expected: ${expected}, Current: ${current}. No changes were made.`;
}
