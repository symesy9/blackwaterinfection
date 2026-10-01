import { RATTOBER_CANVAS_SIZE } from "../config/categories";
import type { RattoberCategoryId } from "../config/categories";
import { resolveRenderStack } from "./layerStack";
import { findTraitById, traitAssetUrl } from "./traits";
import { loadTraitImage } from "./imageLoad";

export type RattoberSelection = Record<RattoberCategoryId, string | null>;

export async function compositeRatToBlob(
  selection: RattoberSelection,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = RATTOBER_CANVAS_SIZE;
  canvas.height = RATTOBER_CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported in this browser.");
  }

  const stack = resolveRenderStack(selection, { includeStructural: true });

  for (const { category, traitId } of stack) {
    const trait = findTraitById(category, traitId);
    if (!trait) continue;
    const url = traitAssetUrl(category, trait.file, "full");
    const img = await loadTraitImage(url);
    ctx.drawImage(img, 0, 0, RATTOBER_CANVAS_SIZE, RATTOBER_CANVAS_SIZE);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to export rat PNG."));
          return;
        }
        resolve(blob);
      },
      "image/png",
    );
  });
}
