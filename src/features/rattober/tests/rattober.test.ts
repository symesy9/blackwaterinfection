import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { PRIMARY_NAV } from "../../../lib/navigation";
import { HOME_ASSETS } from "../../../lib/homeAssets";
import { RATTOBER_CANVAS_SIZE } from "../config/categories";
import {
  RATTOBER_RENDER_ORDER,
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
  it("does not list Rattober in PRIMARY_NAV", () => {
    const navJson = JSON.stringify(PRIMARY_NAV);
    expect(navJson).not.toContain("/rattober");
    expect(navJson).not.toContain("Rattober");
  });

  it("keeps /rattober route in App", () => {
    const appSource = readFileSync(join(repoRoot, "src/App.tsx"), "utf8");
    expect(appSource).toContain('path="/rattober"');
  });
});

describe("Rattober category order", () => {
  it("renders background first and hats last", () => {
    expect(RATTOBER_RENDER_ORDER[0]).toBe("backgrounds");
    expect(RATTOBER_RENDER_ORDER.at(-1)).toBe("hatsHair");
  });

  it("shows background last in UI order", () => {
    expect(RATTOBER_UI_ORDER.at(-1)).toBe("backgrounds");
    expect(RATTOBER_UI_ORDER[0]).toBe("skins");
  });

  it("uses the same six categories in both orders", () => {
    expect([...RATTOBER_RENDER_ORDER].sort()).toEqual([...RATTOBER_UI_ORDER].sort());
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
    partial.skins = getTraitsForCategory("skins")[0]?.id ?? null;
    expect(hasAnyTraitSelected(partial)).toBe(true);
    expect(isSelectionComplete(partial)).toBe(false);

    if (!isManifestReady()) return;
    const full = buildRandomSelection();
    expect(isSelectionComplete(full)).toBe(true);
  });

  it("blocks export until all six categories are chosen", () => {
    const empty = buildEmptySelection();
    expect(exportBlockedMessage(empty)).toMatch(/SELECT BACKGROUND/i);

    if (!isManifestReady()) return;
    const full = buildRandomSelection();
    expect(exportBlockedMessage(full)).toBeNull();
  });

  it("randomises one trait per category when manifest is ready", () => {
    if (!isManifestReady()) return;
    vi.spyOn(Math, "random").mockReturnValue(0);
    const random = buildRandomSelection();
    for (const cat of RATTOBER_RENDER_ORDER) {
      expect(random[cat]).toBe(getTraitsForCategory(cat)[0]?.id);
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
