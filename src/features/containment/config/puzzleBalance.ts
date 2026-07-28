/** Minesweeper-style containment puzzle — tunables */

export const PUZZLE_SIM = {
  tickMs: 50,
  maxCatchUpTicks: 5,
} as const;

export const PUZZLE_LOCKS = {
  /** Safe reveals needed to earn one lock charge */
  revealsPerLock: 2,
  maxStored: 6,
  stageCarryCap: 3,
} as const;

export const PUZZLE_OUTBREAK = {
  /** Reduce spread countdown by this many ms when scanning infected */
  scanPenaltyMs: 3000,
  bonusSpreadOnScan: 0,
} as const;

export const PUZZLE_SCORING = {
  safeReveal: 25,
  correctLock: 150,
  stageComplete: 500,
  spreadTimeBonus: 2,
  deductionStreak: 15,
  infectedScanPenalty: 80,
  wrongLockPenalty: 40,
  coreExposurePenalty: 200,
} as const;

export const PUZZLE_HINTS = {
  tutorialCellId: "0,-2",
  tutorialLockCellId: null as string | null,
} as const;

/** Six outer-ring cells used when expanding from 19 → 25 cells */
const RING3_SAMPLE = [
  { q: 3, r: 0 },
  { q: 0, r: 3 },
  { q: -3, r: 3 },
  { q: -3, r: 0 },
  { q: 0, r: -3 },
  { q: 3, r: -3 },
] as const;

/**
 * Gentle early ramp — stage 2 stays on the same 19-cell board with the same
 * infection count; board size and threats increase only from stage 3 onward.
 */
export const PUZZLE_STAGES = [
  {
    stage: 1,
    radius: 2,
    extraRingCoords: [] as { q: number; r: number }[],
    infectionCount: 2,
    spreadIntervalMs: 14_000,
    spreadGraceMs: 10_000,
    startLocks: 3,
    carryLockCap: 3,
  },
  {
    stage: 2,
    radius: 2,
    extraRingCoords: [],
    infectionCount: 2,
    spreadIntervalMs: 13_000,
    spreadGraceMs: 8000,
    startLocks: 3,
    carryLockCap: 3,
  },
  {
    stage: 3,
    radius: 2,
    extraRingCoords: [...RING3_SAMPLE],
    infectionCount: 3,
    spreadIntervalMs: 12_000,
    spreadGraceMs: 6000,
    startLocks: 2,
    carryLockCap: 3,
  },
  {
    stage: 4,
    radius: 2,
    extraRingCoords: [...RING3_SAMPLE],
    infectionCount: 3,
    spreadIntervalMs: 11_000,
    spreadGraceMs: 5000,
    startLocks: 2,
    carryLockCap: 2,
  },
  {
    stage: 5,
    radius: 2,
    extraRingCoords: [...RING3_SAMPLE],
    infectionCount: 4,
    spreadIntervalMs: 10_000,
    spreadGraceMs: 4000,
    startLocks: 2,
    carryLockCap: 2,
  },
  {
    stage: 6,
    radius: 3,
    extraRingCoords: [],
    infectionCount: 4,
    spreadIntervalMs: 9000,
    spreadGraceMs: 3000,
    startLocks: 2,
    carryLockCap: 2,
  },
  {
    stage: 7,
    radius: 3,
    extraRingCoords: [],
    infectionCount: 5,
    spreadIntervalMs: 7000,
    spreadGraceMs: 2000,
    startLocks: 2,
    carryLockCap: 2,
  },
  {
    stage: 8,
    radius: 3,
    extraRingCoords: [],
    infectionCount: 6,
    spreadIntervalMs: 5000,
    spreadGraceMs: 0,
    startLocks: 2,
    carryLockCap: 2,
  },
] as const;

export function getStageConfig(stage: number) {
  const idx = Math.min(stage - 1, PUZZLE_STAGES.length - 1);
  return PUZZLE_STAGES[idx]!;
}
