/** Back-to-front compositing order (must match export). */
export const RATTOBER_RENDER_ORDER = [
  "backgrounds",
  "skins",
  "clothing",
  "eyes",
  "mouths",
  "hatsHair",
] as const;

/** User-facing category tab order (compositing order unchanged). */
export const RATTOBER_UI_ORDER = [
  "backgrounds",
  "skins",
  "clothing",
  "mouths",
  "eyes",
  "hatsHair",
] as const;

export type RattoberCategoryId = (typeof RATTOBER_RENDER_ORDER)[number];

export const RATTOBER_CATEGORY_LABELS: Record<RattoberCategoryId, string> = {
  backgrounds: "BACKGROUND",
  skins: "SKIN",
  clothing: "CLOTHING",
  eyes: "EYES",
  mouths: "MOUTH",
  hatsHair: "HATS / HAIR",
};

export const RATTOBER_FOLDER_BY_CATEGORY: Record<RattoberCategoryId, string> = {
  backgrounds: "backgrounds",
  skins: "skins",
  clothing: "clothing",
  eyes: "eyes",
  mouths: "mouths",
  hatsHair: "hats-hair",
};

export const RATTOBER_CANVAS_SIZE = 2048;
