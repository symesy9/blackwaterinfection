import type { RattoberCategoryId } from "../config/categories";
import type { RattoberSelection } from "./compositeCanvas";
import {
  firstMissingSelectableCategory,
  hasAnySelectableTraitSelected,
  isSelectableSelectionComplete,
} from "./layerStack";

export function buildEmptySelection(): RattoberSelection {
  return {
    backgrounds: null,
    backgroundOverlays: null,
    skins: null,
    clothing: null,
    lowerRings: null,
    outerRings: null,
    eyes: null,
    mouths: null,
    hatsHair: null,
  };
}

export function hasAnyTraitSelected(selection: RattoberSelection): boolean {
  return hasAnySelectableTraitSelected(selection);
}

export function isSelectionComplete(selection: RattoberSelection): boolean {
  return isSelectableSelectionComplete(selection);
}

export function firstMissingCategory(
  selection: RattoberSelection,
): RattoberCategoryId | null {
  return firstMissingSelectableCategory(selection);
}

function wrapIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return ((index % length) + length) % length;
}

/** Stepper: from null, next → first trait, previous → last trait. */
export function stepTraitId(
  traitIds: string[],
  currentId: string | null,
  direction: -1 | 1,
): string | null {
  if (traitIds.length === 0) return null;
  if (!currentId) {
    return traitIds[direction === 1 ? 0 : traitIds.length - 1] ?? null;
  }
  const idx = traitIds.indexOf(currentId);
  const base = idx >= 0 ? idx : 0;
  return traitIds[wrapIndex(base + direction, traitIds.length)] ?? null;
}

export function formatTraitStepperDisplay(
  selectedIndex: number | null,
  total: number,
): string {
  if (total === 0) return "0 / 0";
  if (selectedIndex == null) return `— / ${total}`;
  return `${selectedIndex + 1} / ${total}`;
}
