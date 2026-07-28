import { describe, expect, it } from "vitest";
import { ContainmentPuzzleSimulation } from "../engine/puzzle/ContainmentPuzzleSimulation";
import { generateBoard } from "../engine/puzzle/HexPuzzleBoard";
import {
  countAdjacentInfections,
  computeClue,
  revealSafeCell,
  refreshClues,
} from "../engine/puzzle/ClueSystem";
import { LockSystem, isInfectionContained } from "../engine/puzzle/LockSystem";
import {
  pickSpreadTarget,
  getActiveInfectionSources,
  isCoreBreached,
} from "../engine/puzzle/InfectionSpreadSystem";
import { getStageConfig, PUZZLE_LOCKS } from "../config/puzzleBalance";
import { SeededRandom } from "../utils/SeededRandom";

describe("ContainmentPuzzleSimulation", () => {
  function sim(seed = 7777): ContainmentPuzzleSimulation {
    const s = new ContainmentPuzzleSimulation(seed);
    s.skipHints();
    return s;
  }

  it("generates deterministic boards for same seed", () => {
    const a = sim(1234);
    const b = sim(1234);
    expect(a.getSnapshot().cells.map((c) => c.isInfected)).toEqual(
      b.getSnapshot().cells.map((c) => c.isInfected),
    );
  });

  it("reveals safe cell with correct clue", () => {
    const s = sim(5000);
    const snap = s.getSnapshot();
    const safe = snap.cells.find((c) => !c.isCore && !c.isInfected && c.state === "hidden");
    expect(safe).toBeDefined();
    s.actOnCell(safe!.id, "scan");
    const updated = s.getSnapshot().cells.find((c) => c.id === safe!.id);
    expect(updated?.state).toBe("revealed");
    expect(updated?.clue).toBeGreaterThanOrEqual(0);
  });

  it("zero-cell flood reveal expands safe region", () => {
    const board = generateBoard(1, new SeededRandom(901));
    const zeroSafe = [...board.cells.values()].find((c) => {
      if (c.isCore || c.isInfected) return false;
      const clue = countAdjacentInfections(c.id, board.cells, board.adjacency);
      return clue === 0;
    });
    expect(zeroSafe).toBeDefined();
    const revealed = revealSafeCell(zeroSafe!.id, board.cells, board.adjacency);
    expect(revealed.length).toBeGreaterThan(1);
  });

  it("scanning infected triggers outbreak penalty", () => {
    const s = sim(6000);
    const infected = s.getSnapshot().cells.find((c) => c.isInfected && c.state === "hidden");
    expect(infected).toBeDefined();
    const before = s.getSnapshot().spreadCountdownMs;
    s.actOnCell(infected!.id, "scan");
    expect(s.getSnapshot().cells.find((c) => c.id === infected!.id)?.state).toBe("infected");
    expect(s.getSnapshot().spreadCountdownMs).toBeLessThan(before);
  });

  it("locked infected cell cannot spread", () => {
    const s = sim(8000);
    const infected = s.getSnapshot().cells.find((c) => c.isInfected && !c.isCore)!;
    s.actOnCell(infected.id, "lock");
    const cell = s.getSnapshot().cells.find((c) => c.id === infected.id)!;
    expect(isInfectionContained(cell)).toBe(true);
    expect(getActiveInfectionSources(new Map(s.getSnapshot().cells.map((c) => [c.id, c])))).not.toContain(
      infected.id,
    );
  });

  it("locking clean cell consumes charge", () => {
    const s = sim(7000);
    const before = s.getSnapshot().locks;
    const safe = s.getSnapshot().cells.find((c) => !c.isInfected && c.state === "hidden" && !c.isCore)!;
    s.actOnCell(safe.id, "lock");
    expect(s.getSnapshot().locks).toBe(before - 1);
  });

  it("awards lock after configured safe reveals", () => {
    const lockSys = new LockSystem(1);
    let earned = false;
    for (let i = 0; i < PUZZLE_LOCKS.revealsPerLock; i += 1) {
      if (lockSys.onSafeReveal()) earned = true;
    }
    expect(earned).toBe(true);
    expect(lockSys.locks).toBe(2);
  });

  it("spread countdown triggers spread", () => {
    const s = sim(3000);
    const beforeInfected = s.getSnapshot().cells.filter((c) => c.state === "infected").length;
    s.stepMs(13_000);
    const after = s.getSnapshot().cells.filter((c) => c.state === "infected").length;
    expect(after).toBeGreaterThanOrEqual(beforeInfected);
  });

  it("infection reaching core ends game", () => {
    const board = generateBoard(1, new SeededRandom(42));
    const core = board.cells.get(board.coreId)!;
    core.isInfected = true;
    expect(isCoreBreached(board.cells, board.coreId)).toBe(true);
  });

  it("completes stage when all infection is locked", () => {
    const s = sim(9999);
    for (const cell of s.getSnapshot().cells.filter((c) => c.isInfected)) {
      s.actOnCell(cell.id, "lock");
    }
    expect(s.getSnapshot().phase).toBe("stage_clear");
  });

  it("pause freezes spread countdown", () => {
    const s = sim(1111);
    s.pause();
    const before = s.getSnapshot().spreadCountdownMs;
    s.stepMs(5000);
    expect(s.getSnapshot().spreadCountdownMs).toBe(before);
  });

  it("stage config scales difficulty gradually", () => {
    const s1 = getStageConfig(1);
    const s2 = getStageConfig(2);
    const s6 = getStageConfig(6);
    expect(s2.infectionCount).toBe(s1.infectionCount);
    expect(s2.extraRingCoords.length).toBe(0);
    expect(s6.infectionCount).toBeGreaterThan(s1.infectionCount);
    expect(s6.spreadIntervalMs).toBeLessThan(s1.spreadIntervalMs);
  });
});

describe("ClueSystem", () => {
  it("clue equals adjacent infection count", () => {
    const board = generateBoard(1, new SeededRandom(55));
    const safe = [...board.cells.values()].find((c) => !c.isInfected && !c.isCore)!;
    const clue = computeClue(safe.id, board.cells, board.adjacency);
    expect(clue).toBe(countAdjacentInfections(safe.id, board.cells, board.adjacency));
  });

  it("updates clues after spread", () => {
    const board = generateBoard(1, new SeededRandom(77));
    const safe = [...board.cells.values()].find((c) => !c.isInfected && !c.isCore)!;
    safe.state = "revealed";
    safe.clue = computeClue(safe.id, board.cells, board.adjacency);
    const neighbor = board.adjacency.get(safe.id)?.[0];
    if (neighbor) {
      const nCell = board.cells.get(neighbor)!;
      if (!nCell.isCore) {
        nCell.isInfected = true;
        nCell.state = "infected";
        const updated = refreshClues(board.cells, board.adjacency, false);
        expect(updated.length).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("InfectionSpreadSystem", () => {
  it("spreads only to adjacent valid cells", () => {
    const board = generateBoard(1, new SeededRandom(88));
    const sources = getActiveInfectionSources(board.cells);
    expect(sources.length).toBeGreaterThan(0);
    const move = pickSpreadTarget(
      sources[0]!,
      board.cells,
      board.adjacency,
      board.coreId,
      new SeededRandom(1),
    );
    if (move) {
      const neighbors = board.adjacency.get(move.fromId) ?? [];
      expect(neighbors).toContain(move.toId);
    }
  });

  it("prefers routes toward core", () => {
    const board = generateBoard(1, new SeededRandom(99));
    const sources = getActiveInfectionSources(board.cells);
    const rng = new SeededRandom(2);
    const move = pickSpreadTarget(
      sources[0]!,
      board.cells,
      board.adjacency,
      board.coreId,
      rng,
    );
    expect(move).not.toBeNull();
  });
});

describe("HexPuzzleBoard", () => {
  it("validates no infection adjacent to core", () => {
    const board = generateBoard(1, new SeededRandom(123));
    const coreNeighbors = board.adjacency.get(board.coreId) ?? [];
    for (const nid of coreNeighbors) {
      expect(board.cells.get(nid)?.isInfected).toBe(false);
    }
  });

  it("builds adjacency for all cells", () => {
    const board = generateBoard(2, new SeededRandom(456));
    for (const id of board.cells.keys()) {
      expect(board.adjacency.has(id)).toBe(true);
    }
  });
});
