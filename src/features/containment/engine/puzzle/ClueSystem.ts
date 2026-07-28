import type { PuzzleCell } from "../../types/puzzle";

export function countAdjacentInfections(
  cellId: string,
  cells: Map<string, PuzzleCell>,
  adjacency: Map<string, string[]>,
): number {
  const neighbors = adjacency.get(cellId) ?? [];
  return neighbors.filter((nid) => cells.get(nid)?.isInfected).length;
}

export function computeClue(
  cellId: string,
  cells: Map<string, PuzzleCell>,
  adjacency: Map<string, string[]>,
): number {
  return countAdjacentInfections(cellId, cells, adjacency);
}

export function refreshClues(
  cells: Map<string, PuzzleCell>,
  adjacency: Map<string, string[]>,
  pulse = true,
): string[] {
  const updated: string[] = [];
  for (const cell of cells.values()) {
    if (cell.state !== "revealed") continue;
    const next = computeClue(cell.id, cells, adjacency);
    if (cell.clue !== next) {
      cell.clue = next;
      cell.cluePulse = pulse;
      updated.push(cell.id);
    }
  }
  return updated;
}

export function revealSafeCell(
  cellId: string,
  cells: Map<string, PuzzleCell>,
  adjacency: Map<string, string[]>,
  allowZeroFlood = true,
): string[] {
  if (!allowZeroFlood) {
    const cell = cells.get(cellId);
    if (!cell || cell.isCore || cell.state === "locked" || cell.isInfected) {
      return [];
    }
    if (cell.state === "revealed") return [];
    cell.state = "revealed";
    cell.clue = computeClue(cellId, cells, adjacency);
    cell.cluePulse = false;
    return [cellId];
  }

  const revealed: string[] = [];
  const queue = [cellId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const cell = cells.get(id);
    if (!cell || cell.isCore || cell.state === "locked") continue;
    if (cell.isInfected) continue;
    if (cell.state === "revealed") continue;

    cell.state = "revealed";
    cell.clue = computeClue(id, cells, adjacency);
    cell.cluePulse = false;
    revealed.push(id);

    if (cell.clue === 0) {
      for (const nid of adjacency.get(id) ?? []) {
        const neighbor = cells.get(nid);
        if (!neighbor || neighbor.isCore) continue;
        if (neighbor.state === "hidden") {
          queue.push(nid);
        }
      }
    }
  }

  return revealed;
}

export function markInfectedVisible(cell: PuzzleCell): void {
  cell.state = "infected";
  cell.clue = null;
}
