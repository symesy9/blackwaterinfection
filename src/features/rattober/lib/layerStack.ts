import {
  RATTOBER_RENDER_ORDER,
  RATTOBER_SELECTABLE_ORDER,
  RATTOBER_LAYER_BY_ID,
  type RattoberCategoryId,
} from "../config/categories";
import type { RattoberSelection } from "./compositeCanvas";
import { findTraitById, getTraitsForCategory } from "./traits";

export type ResolvedRenderLayer = {
  category: RattoberCategoryId;
  traitId: string;
};

function soleStructuralTraitId(category: RattoberCategoryId): string | null {
  const traits = getTraitsForCategory(category);
  if (traits.length === 1) return traits[0]!.id;
  return null;
}

function resolveStructuralRingTraitId(
  category: "lowerRings" | "outerRings",
  selection: RattoberSelection,
  includeStructural: boolean,
): string | null {
  if (!includeStructural) return null;
  if (!selection.clothing) return null;
  return soleStructuralTraitId(category);
}

function resolveTraitIdForLayer(
  category: RattoberCategoryId,
  selection: RattoberSelection,
  includeStructural: boolean,
): string | null {
  if (category === "lowerRings" || category === "outerRings") {
    return resolveStructuralRingTraitId(category, selection, includeStructural);
  }

  const layer = RATTOBER_LAYER_BY_ID[category];
  const selected = selection[category];
  if (selected) return selected;

  if (!includeStructural || layer.selectable) return null;

  if (!layer.autoApplyWhenSingle) return null;

  return soleStructuralTraitId(category);
}

/** Canonical back-to-front stack for preview and export. */
export function resolveRenderStack(
  selection: RattoberSelection,
  options?: { includeStructural?: boolean },
): ResolvedRenderLayer[] {
  const includeStructural = options?.includeStructural ?? true;
  const layers: ResolvedRenderLayer[] = [];

  for (const category of RATTOBER_RENDER_ORDER) {
    const traitId = resolveTraitIdForLayer(
      category,
      selection,
      includeStructural,
    );
    if (!traitId) continue;
    if (!findTraitById(category, traitId)) continue;
    layers.push({ category, traitId });
  }

  return layers;
}

export function hasAnySelectableTraitSelected(
  selection: RattoberSelection,
): boolean {
  return RATTOBER_SELECTABLE_ORDER.some((cat) => selection[cat] != null);
}

export function isSelectableSelectionComplete(
  selection: RattoberSelection,
): boolean {
  return RATTOBER_SELECTABLE_ORDER.every((cat) => {
    const available = getTraitsForCategory(cat).length;
    if (available === 0) return true;
    return selection[cat] != null;
  });
}

export function firstMissingSelectableCategory(
  selection: RattoberSelection,
): RattoberCategoryId | null {
  for (const cat of RATTOBER_SELECTABLE_ORDER) {
    if (getTraitsForCategory(cat).length === 0) continue;
    if (!selection[cat]) return cat;
  }
  return null;
}
