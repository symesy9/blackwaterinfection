import { describe, expect, it } from "vitest";
import {
  RATTOBER_RENDER_ORDER,
  RATTOBER_UI_ORDER,
} from "../config/categories";
import { resolveRenderStack } from "../lib/layerStack";
import { buildEmptySelection } from "../lib/selectionState";
import { buildRandomSelection, getTraitsForCategory } from "../lib/traits";

describe("Rattober render stack", () => {
  it("uses the nine-layer render order with rings sandwiching clothing", () => {
    expect(RATTOBER_RENDER_ORDER).toEqual([
      "backgrounds",
      "backgroundOverlays",
      "skins",
      "lowerRings",
      "eyes",
      "clothing",
      "outerRings",
      "mouths",
      "hatsHair",
    ]);
  });

  it("lists public UI tabs in creator order", () => {
    expect(RATTOBER_UI_ORDER).toEqual([
      "backgrounds",
      "backgroundOverlays",
      "skins",
      "clothing",
      "eyes",
      "mouths",
    ]);
  });

  it("orders resolved layers by render index", () => {
    const selection = buildEmptySelection();
    selection.backgrounds = getTraitsForCategory("backgrounds")[0]?.id ?? null;
    selection.backgroundOverlays =
      getTraitsForCategory("backgroundOverlays")[0]?.id ?? null;
    selection.skins = getTraitsForCategory("skins")[0]?.id ?? null;
    selection.clothing = getTraitsForCategory("clothing")[0]?.id ?? null;
    selection.eyes = getTraitsForCategory("eyes")[0]?.id ?? null;
    selection.mouths = getTraitsForCategory("mouths")[0]?.id ?? null;
    if (
      !selection.backgrounds ||
      !selection.backgroundOverlays ||
      !selection.skins ||
      !selection.clothing ||
      !selection.eyes ||
      !selection.mouths
    ) {
      return;
    }

    const stack = resolveRenderStack(selection, { includeStructural: true });
    const categories = stack.map((l) => l.category);

    const skinIdx = categories.indexOf("skins");
    const lowerIdx = categories.indexOf("lowerRings");
    const eyesIdx = categories.indexOf("eyes");
    const clothingIdx = categories.indexOf("clothing");
    const outerIdx = categories.indexOf("outerRings");

    expect(skinIdx).toBeGreaterThanOrEqual(0);
    expect(lowerIdx).toBeGreaterThan(skinIdx);
    expect(eyesIdx).toBeGreaterThan(lowerIdx);
    expect(clothingIdx).toBeGreaterThan(eyesIdx);
    expect(outerIdx).toBeGreaterThan(clothingIdx);
  });

  it("includes both rings when clothing is selected", () => {
    if (getTraitsForCategory("lowerRings").length !== 1) return;
    if (getTraitsForCategory("outerRings").length !== 1) return;

    const ghoul = getTraitsForCategory("clothing").find(
      (t) => t.file === "Ghoul.png",
    );
    const witchOutfit = getTraitsForCategory("clothing").find(
      (t) => t.file === "Witch outfit.png",
    );
    if (!ghoul || !witchOutfit) return;

    for (const clothingId of [ghoul.id, witchOutfit.id]) {
      const selection = buildEmptySelection();
      selection.skins = getTraitsForCategory("skins")[0]?.id ?? null;
      selection.clothing = clothingId;
      const stack = resolveRenderStack(selection, { includeStructural: true });
      expect(stack.some((l) => l.category === "lowerRings")).toBe(true);
      expect(stack.some((l) => l.category === "outerRings")).toBe(true);
    }

    const noClothing = buildEmptySelection();
    noClothing.skins = getTraitsForCategory("skins")[0]?.id ?? null;
    const noRing = resolveRenderStack(noClothing, { includeStructural: true });
    expect(noRing.some((l) => l.category === "lowerRings")).toBe(false);
    expect(noRing.some((l) => l.category === "outerRings")).toBe(false);
  });

  it("does not randomise structural layers", () => {
    const random = buildRandomSelection();
    expect(random.lowerRings).toBeNull();
    expect(random.outerRings).toBeNull();
  });
});
