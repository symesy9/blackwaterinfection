/** Layer definition — single source for folders, UI, and compositing. */
export type RattoberCategoryId =
  | "backgrounds"
  | "backgroundOverlays"
  | "skins"
  | "clothing"
  | "lowerRings"
  | "outerRings"
  | "eyes"
  | "mouths"
  | "hatsHair";

export type RattoberLayerConfig = {
  id: RattoberCategoryId;
  folder: string;
  label: string;
  /** Included in user selection, randomise, and export completeness (when traits exist). */
  selectable: boolean;
  /** Shown as a creator tab. */
  showInUI: boolean;
  /** When exactly one PNG exists, auto-composite after creation begins (not while idle). */
  autoApplyWhenSingle: boolean;
};

export const RATTOBER_LAYERS: readonly RattoberLayerConfig[] = [
  {
    id: "backgrounds",
    folder: "backgrounds",
    label: "BACKGROUND",
    selectable: true,
    showInUI: true,
    autoApplyWhenSingle: false,
  },
  {
    id: "backgroundOverlays",
    folder: "background-overlays",
    label: "SCENE",
    selectable: true,
    showInUI: true,
    autoApplyWhenSingle: false,
  },
  {
    id: "skins",
    folder: "skins",
    label: "SKIN",
    selectable: true,
    showInUI: true,
    autoApplyWhenSingle: false,
  },
  {
    id: "lowerRings",
    folder: "lower-rings",
    label: "LOWER RING",
    selectable: false,
    showInUI: false,
    autoApplyWhenSingle: true,
  },
  {
    id: "eyes",
    folder: "eyes",
    label: "EYES",
    selectable: true,
    showInUI: true,
    autoApplyWhenSingle: false,
  },
  {
    id: "clothing",
    folder: "clothing",
    label: "CLOTHING",
    selectable: true,
    showInUI: true,
    autoApplyWhenSingle: false,
  },
  {
    id: "outerRings",
    folder: "outer-rings",
    label: "OUTER RING",
    selectable: false,
    showInUI: false,
    autoApplyWhenSingle: true,
  },
  {
    id: "mouths",
    folder: "mouths",
    label: "MOUTH",
    selectable: true,
    showInUI: true,
    autoApplyWhenSingle: false,
  },
  {
    id: "hatsHair",
    folder: "hats-hair",
    label: "HATS / HAIR",
    selectable: true,
    showInUI: false,
    autoApplyWhenSingle: false,
  },
];

/** Back-to-front compositing order (must match export). */
export const RATTOBER_RENDER_ORDER: readonly RattoberCategoryId[] =
  RATTOBER_LAYERS.map((l) => l.id);

/** Creator tab order (selectable layers with showInUI). */
export const RATTOBER_UI_ORDER: readonly RattoberCategoryId[] = [
  "backgrounds",
  "backgroundOverlays",
  "skins",
  "clothing",
  "eyes",
  "mouths",
];

export const RATTOBER_SELECTABLE_ORDER: readonly RattoberCategoryId[] =
  RATTOBER_LAYERS.filter((l) => l.selectable).map((l) => l.id);

export const RATTOBER_CATEGORY_LABELS: Record<RattoberCategoryId, string> =
  Object.fromEntries(RATTOBER_LAYERS.map((l) => [l.id, l.label])) as Record<
    RattoberCategoryId,
    string
  >;

export const RATTOBER_FOLDER_BY_CATEGORY: Record<RattoberCategoryId, string> =
  Object.fromEntries(RATTOBER_LAYERS.map((l) => [l.id, l.folder])) as Record<
    RattoberCategoryId,
    string
  >;

export const RATTOBER_LAYER_BY_ID: Record<
  RattoberCategoryId,
  RattoberLayerConfig
> = Object.fromEntries(RATTOBER_LAYERS.map((l) => [l.id, l])) as Record<
  RattoberCategoryId,
  RattoberLayerConfig
>;

export const RATTOBER_CANVAS_SIZE = 2048;
