import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { PRIMARY_NAV } from "../../../lib/navigation";
import { HOME_ASSETS } from "../../../lib/homeAssets";
import { RATTOBER_CANVAS_SIZE } from "../config/categories";
import {
  RATTOBER_RENDER_ORDER,
  RATTOBER_SELECTABLE_ORDER,
  RATTOBER_UI_ORDER,
} from "../config/categories";
import {
  RATTOBER_SHARE_CAPTION,
  rattoberDownloadFilename,
} from "../config/shareCopy";
import { exportBlockedMessage } from "../hooks/useRattoberCreator";
import { randomSubjectId } from "../lib/subjectId";
import {
  buildEmptySelection,
  formatTraitStepperDisplay,
  hasAnyTraitSelected,
  isSelectionComplete,
  stepTraitId,
} from "../lib/selectionState";
import {
  buildRandomSelection,
  getTraitsForCategory,
  isManifestReady,
} from "../lib/traits";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("Rattober navigation", () => {
  it("lists Rattober in PRIMARY_NAV", () => {
    const navJson = JSON.stringify(PRIMARY_NAV);
    expect(navJson).toContain("/rattober");
    expect(navJson).toContain("Rattober");
  });

  it("keeps /rattober route in App", () => {
    const appSource = readFileSync(join(repoRoot, "src/App.tsx"), "utf8");
    expect(appSource).toContain('path="/rattober"');
  });
});

describe("Rattober category order", () => {
  it("renders background first, eyes under clothing, rings sandwich clothing, hats last", () => {
    expect(RATTOBER_RENDER_ORDER[0]).toBe("backgrounds");
    expect(RATTOBER_RENDER_ORDER.at(-1)).toBe("hatsHair");
    const clothingIdx = RATTOBER_RENDER_ORDER.indexOf("clothing");
    expect(RATTOBER_RENDER_ORDER.indexOf("lowerRings")).toBe(clothingIdx - 2);
    expect(RATTOBER_RENDER_ORDER.indexOf("eyes")).toBe(clothingIdx - 1);
    expect(RATTOBER_RENDER_ORDER.indexOf("outerRings")).toBe(clothingIdx + 1);
  });

  it("lists background first and mouth last in UI tab order", () => {
    expect(RATTOBER_UI_ORDER[0]).toBe("backgrounds");
    expect(RATTOBER_UI_ORDER.at(-1)).toBe("mouths");
    expect(RATTOBER_UI_ORDER).not.toContain("hatsHair");
  });

  it("includes every UI category in the render stack", () => {
    for (const cat of RATTOBER_UI_ORDER) {
      expect(RATTOBER_RENDER_ORDER).toContain(cat);
    }
  });
});

describe("Rattober share copy", () => {
  it("keeps caption in one place", () => {
    expect(RATTOBER_SHARE_CAPTION).toContain("#Rattober");
    expect(RATTOBER_SHARE_CAPTION).toContain("Blackwater Labs");
  });

  it("builds download filename with subject id", () => {
    expect(rattoberDownloadFilename("RT-0042")).toMatch(/blackwater-rattober-rt-0042/);
  });
});

describe("Rattober subject id", () => {
  it("formats RT-#### ids", () => {
    expect(randomSubjectId()).toMatch(/^RT-\d{4}$/);
  });
});

describe("Rattober idle logo asset", () => {
  it("uses the official Blackwater header logo", () => {
    expect(HOME_ASSETS.headerLogo).toContain("blackwater-logo.png");
  });
});

describe("Rattober selection state", () => {
  it("starts with no traits selected", () => {
    const empty = buildEmptySelection();
    for (const cat of RATTOBER_RENDER_ORDER) {
      expect(empty[cat]).toBeNull();
    }
    expect(hasAnyTraitSelected(empty)).toBe(false);
    expect(isSelectionComplete(empty)).toBe(false);
  });

  it("detects progressive build and completion", () => {
    const partial = buildEmptySelection();
    partial.skins = "skins-example";
    expect(hasAnyTraitSelected(partial)).toBe(true);
    expect(isSelectionComplete(partial)).toBe(false);

    if (!isManifestReady()) return;
    const full = buildRandomSelection();
    expect(isSelectionComplete(full)).toBe(true);
  });

  it("blocks export until required selectable categories are chosen", () => {
    const empty = buildEmptySelection();
    expect(exportBlockedMessage(empty)).toMatch(/SELECT BACKGROUND/i);

    if (!isManifestReady()) return;
    const full = buildRandomSelection();
    expect(exportBlockedMessage(full)).toBeNull();
  });

  it("randomises selectable categories only when manifest is ready", () => {
    if (!isManifestReady()) return;
    vi.spyOn(Math, "random").mockReturnValue(0);
    const random = buildRandomSelection();
    expect(random.lowerRings).toBeNull();
    expect(random.outerRings).toBeNull();
    for (const cat of RATTOBER_SELECTABLE_ORDER) {
      const list = getTraitsForCategory(cat);
      if (list.length === 0) {
        expect(random[cat]).toBeNull();
      } else {
        expect(random[cat]).toBe(list[0]?.id);
      }
    }
    vi.restoreAllMocks();
  });

  it("formats stepper display with em dash when unselected", () => {
    expect(formatTraitStepperDisplay(null, 11)).toBe("— / 11");
    expect(formatTraitStepperDisplay(3, 11)).toBe("4 / 11");
  });

  it("steps from null to first or last trait", () => {
    const ids = ["a", "b", "c"];
    expect(stepTraitId(ids, null, 1)).toBe("a");
    expect(stepTraitId(ids, null, -1)).toBe("c");
    expect(stepTraitId(ids, "b", 1)).toBe("c");
    expect(stepTraitId(ids, "c", 1)).toBe("a");
  });
});

describe("Rattober export canvas", () => {
  it("uses 2048×2048 source size", () => {
    expect(RATTOBER_CANVAS_SIZE).toBe(2048);
  });
});
