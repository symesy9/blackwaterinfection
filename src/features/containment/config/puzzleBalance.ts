/** Minesweeper-style containment puzzle — tunables */

import type { PuzzleStageConfig } from "../types/puzzle";

export const PUZZLE_SIM = {
  tickMs: 50,
  maxCatchUpTicks: 5,
} as const;

export const PUZZLE_LOCKS = {
  revealsPerLock: 2,
  maxStored: 6,
  stageCarryCap: 3,
} as const;

/** Stages 6+ use this for full zero-region flood */
export const PUZZLE_FULL_BURST = 999;

export const PUZZLE_OUTBREAK = {
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

const RING3_SAMPLE = [
  { q: 3, r: 0 },
  { q: 0, r: 3 },
  { q: -3, r: 3 },
  { q: -3, r: 0 },
  { q: 0, r: -3 },
  { q: 3, r: -3 },
] as const;

export const PUZZLE_STAGES = [
  {
    stage: 1,
    radius: 2,
    extraRingCoords: [...RING3_SAMPLE],
    infectionCount: 4,
    spreadIntervalMs: 22_000,
    spreadGraceMs: 18_000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 4,
    minInfectionSeparation: 2,
  },
  {
    stage: 2,
    radius: 2,
    extraRingCoords: [...RING3_SAMPLE],
    infectionCount: 4,
    spreadIntervalMs: 20_000,
    spreadGraceMs: 14_000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 4,
    minInfectionSeparation: 2,
  },
  {
    stage: 3,
    radius: 2,
    extraRingCoords: [...RING3_SAMPLE],
    infectionCount: 5,
    spreadIntervalMs: 18_000,
    spreadGraceMs: 12_000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 5,
    minInfectionSeparation: 2,
  },
  {
    stage: 4,
    radius: 3,
    extraRingCoords: [],
    infectionCount: 5,
    spreadIntervalMs: 16_000,
    spreadGraceMs: 10_000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 5,
    minInfectionSeparation: 2,
  },
  {
    stage: 5,
    radius: 3,
    extraRingCoords: [],
    infectionCount: 6,
    spreadIntervalMs: 14_000,
    spreadGraceMs: 8000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 6,
    minInfectionSeparation: 2,
  },
  {
    stage: 6,
    radius: 3,
    extraRingCoords: [],
    infectionCount: 6,
    spreadIntervalMs: 12_000,
    spreadGraceMs: 6000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 8,
    minInfectionSeparation: 2,
  },
  {
    stage: 7,
    radius: 3,
    extraRingCoords: [],
    infectionCount: 7,
    spreadIntervalMs: 10_000,
    spreadGraceMs: 4000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 10,
    minInfectionSeparation: 2,
  },
  {
    stage: 8,
    radius: 3,
    extraRingCoords: [],
    infectionCount: 8,
    spreadIntervalMs: 8000,
    spreadGraceMs: 2000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: PUZZLE_FULL_BURST,
    minInfectionSeparation: 2,
  },
] as const;

export function getStageConfig(stage: number): PuzzleStageConfig {
  const idx = Math.min(stage - 1, PUZZLE_STAGES.length - 1);
  const cfg = PUZZLE_STAGES[idx]!;
  return {
    ...cfg,
    extraRingCoords: [...cfg.extraRingCoords],
  };
}
