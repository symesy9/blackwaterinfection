import { describe, expect, it } from "vitest";
import {
  RATTOBER_RENDER_ORDER,
  RATTOBER_UI_ORDER,
} from "../config/categories";
import { resolveRenderStack } from "../lib/layerStack";
import { buildEmptySelection } from "../lib/selectionState";
import { buildRandomSelection, getTraitsForCategory } from "../lib/traits";

describe("Rattober render stack", () => {
  it("uses the nine-layer render order", () => {
    expect(RATTOBER_RENDER_ORDER).toEqual([
      "backgrounds",
      "backgroundOverlays",
      "skins",
      "clothing",
      "lowerRings",
      "outerRings",
      "eyes",
      "mouths",
      "hatsHair",
    ]);
  });

  it("lists public UI tabs in creator order", () => {
    expect(RATTOBER_UI_ORDER).toEqual([
      "skins",
      "clothing",
      "eyes",
      "mouths",
      "hatsHair",
      "backgrounds",
      "backgroundOverlays",
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

    const bgIdx = categories.indexOf("backgrounds");
    const overlayIdx = categories.indexOf("backgroundOverlays");
    const skinIdx = categories.indexOf("skins");
    const clothingIdx = categories.indexOf("clothing");
    const lowerIdx = categories.indexOf("lowerRings");
    const outerIdx = categories.indexOf("outerRings");
    const eyesIdx = categories.indexOf("eyes");
    const mouthIdx = categories.indexOf("mouths");

    expect(bgIdx).toBeGreaterThanOrEqual(0);
    expect(overlayIdx).toBeGreaterThan(bgIdx);
    expect(skinIdx).toBeGreaterThan(overlayIdx);
    expect(clothingIdx).toBeGreaterThan(skinIdx);
    if (lowerIdx >= 0) expect(lowerIdx).toBeGreaterThan(clothingIdx);
    if (outerIdx >= 0) expect(outerIdx).toBeGreaterThan(lowerIdx);
    expect(eyesIdx).toBeGreaterThan(outerIdx >= 0 ? outerIdx : clothingIdx);
    expect(mouthIdx).toBeGreaterThan(eyesIdx);
  });

  it("auto-includes single structural ring layers when enabled", () => {
    if (getTraitsForCategory("lowerRings").length !== 1) return;
    const selection = buildEmptySelection();
    selection.skins = getTraitsForCategory("skins")[0]?.id ?? null;
    if (!selection.skins) return;

    const without = resolveRenderStack(selection, { includeStructural: false });
    expect(without.some((l) => l.category === "lowerRings")).toBe(false);

    const withStructural = resolveRenderStack(selection, {
      includeStructural: true,
    });
    expect(withStructural.some((l) => l.category === "lowerRings")).toBe(true);
    expect(withStructural.some((l) => l.category === "outerRings")).toBe(true);
  });

  it("does not randomise structural layers", () => {
    const random = buildRandomSelection();
    expect(random.lowerRings).toBeNull();
    expect(random.outerRings).toBeNull();
  });
});
